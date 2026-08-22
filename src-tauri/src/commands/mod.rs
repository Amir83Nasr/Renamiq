//! Tauri command layer: thin wrappers — no business logic here.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::core::error::{AppResult, RenamiqError};
use crate::database::Db;
use crate::rename::executor;
use crate::rename::planner::{self, RenamePlan};
use crate::scanner;

#[derive(Deserialize)]
pub struct ScanArgs {
    pub path: String,
}

#[tauri::command]
pub fn scan_folder(args: ScanArgs) -> AppResult<scanner::ScanResult> {
    let root = PathBuf::from(&args.path);
    if !root.is_dir() {
        return Err(RenamiqError::user(format!(
            "Folder not found: {}",
            root.display()
        )));
    }
    scanner::scan_directory(&root)
        .map_err(|e| RenamiqError::with_source(format!("Could not scan {}", root.display()), e))
}

#[derive(Deserialize)]
pub struct PlanArgs {
    pub scan: scanner::ScanResult,
    pub organize: bool,
}

#[tauri::command]
pub fn build_rename_plan(args: PlanArgs) -> RenamePlan {
    planner::build_plan(Path::new(&args.scan.root), &args.scan.files, args.organize)
}

#[tauri::command]
pub fn execute_operations(
    ops: Vec<planner::PlannedOp>,
    overwrite_ids: Vec<String>,
    db: State<'_, Db>,
) -> AppResult<Vec<executor::OpResult>> {
    let results = executor::execute_plan(&ops, &overwrite_ids)?;
    let journal: Vec<JournalRow> = results
        .iter()
        .zip(ops.iter())
        .filter(|(r, _)| r.ok)
        .map(|(_, op)| JournalRow {
            from: op.source.display().to_string(),
            to: op.destination.display().to_string(),
        })
        .collect();
    record_operation(&db, "rename", &journal)?;
    Ok(results)
}

#[derive(Deserialize, serde::Serialize)]
struct JournalRow {
    from: String,
    to: String,
}

fn record_operation(db: &State<'_, Db>, kind: &str, journal: &[JournalRow]) -> AppResult<()> {
    let conn =
        db.0.lock()
            .map_err(|_| RenamiqError::user("Database busy"))?;
    let json = serde_json::to_string(journal)
        .map_err(|e| RenamiqError::with_source("Could not serialize journal", e))?;
    conn.execute(
        "INSERT INTO operations (kind, summary, status, undo_journal) VALUES (?1, ?2, 'completed', ?3)",
        rusqlite::params![
            kind,
            format!("{} file(s)", journal.len()),
            json
        ],
    )
    .map_err(|e| RenamiqError::with_source("Could not save operation history", e))?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationHistoryItem {
    pub id: i64,
    pub kind: String,
    pub summary: String,
    pub status: String,
    pub created_at: String,
    pub can_undo: bool,
    pub item_count: usize,
}

#[tauri::command]
pub fn list_operations(db: State<'_, Db>) -> AppResult<Vec<OperationHistoryItem>> {
    let conn =
        db.0.lock()
            .map_err(|_| RenamiqError::user("Database busy"))?;
    let mut stmt = conn
        .prepare("SELECT id, kind, summary, status, created_at, undo_journal FROM operations ORDER BY id DESC LIMIT 200")
        .map_err(|e| RenamiqError::with_source("Could not read history", e))?;
    let rows = stmt
        .query_map([], |r| {
            let journal: Option<String> = r.get(5)?;
            Ok(OperationHistoryItem {
                id: r.get(0)?,
                kind: r.get(1)?,
                summary: r.get(2)?,
                status: r.get(3)?,
                created_at: r.get(4)?,
                can_undo: journal.is_some(),
                item_count: journal
                    .as_deref()
                    .and_then(|j| serde_json::from_str::<Vec<JournalRow>>(j).ok())
                    .map(|v| v.len())
                    .unwrap_or(0),
            })
        })
        .map_err(|e| RenamiqError::with_source("Could not read history", e))?;
    let items = rows.filter_map(Result::ok).collect();
    drop(stmt);
    Ok(items)
}

/// Undo the most recent reversible operation by replaying the journal
/// backwards. Only renames/moves are journaled, so reversal is exact.
#[tauri::command]
pub fn undo_last_operation(db: State<'_, Db>) -> AppResult<String> {
    let conn =
        db.0.lock()
            .map_err(|_| RenamiqError::user("Database busy"))?;
    let row: Option<(i64, String)> = conn
        .query_row(
            "SELECT id, undo_journal FROM operations WHERE undo_journal IS NOT NULL ORDER BY id DESC LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })
        .map_err(|e| RenamiqError::with_source("Could not read history", e))?;

    let Some((op_id, journal_json)) = row else {
        return Err(RenamiqError::user("Nothing to undo"));
    };
    let journal: Vec<JournalRow> = serde_json::from_str(&journal_json)
        .map_err(|e| RenamiqError::with_source("Undo journal is corrupted", e))?;

    let mut undone = 0usize;
    for entry in journal.iter().rev() {
        let from = PathBuf::from(&entry.to);
        let to = PathBuf::from(&entry.from);
        if from.exists() {
            if let Some(parent) = to.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::rename(&from, &to).map_err(|e| {
                RenamiqError::with_source(format!("Could not restore {}", to.display()), e)
            })?;
            undone += 1;
        }
    }
    conn.execute(
        "UPDATE operations SET undo_journal = NULL WHERE id = ?1",
        [op_id],
    )
    .map_err(|e| RenamiqError::with_source("Could not update history", e))?;
    Ok(format!("Restored {undone} file(s)"))
}
