//! Tauri command layer: thin wrappers — no business logic here.

use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::core::error::{AppResult, RenamiqError};
use crate::database::Db;
use crate::rename::executor::{self, JournalEntry, OpResult};
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
        .map_err(|e| RenamiqError::with_source("Could not read that folder.", e))
}

#[derive(Deserialize)]
pub struct ScanPathsArgs {
    pub paths: Vec<String>,
}

#[tauri::command]
pub fn scan_paths(args: ScanPathsArgs) -> AppResult<scanner::ScanResult> {
    let paths: Vec<PathBuf> = args.paths.iter().map(PathBuf::from).collect();
    if paths.is_empty() {
        return Err(RenamiqError::user("No files selected"));
    }
    scanner::scan_paths(&paths)
        .map_err(|e| RenamiqError::with_source("Could not read the selection.", e))
}

#[tauri::command]
pub fn build_rename_plan(args: planner::PlanRequest) -> RenamePlan {
    planner::build_plan(&args)
}

/// Execute the plan items the user approved. Returns per-file results with
/// ACTUAL destinations; successful ops are journaled for undo.
#[tauri::command]
pub fn execute_operations(
    items: Vec<planner::PlanItem>,
    resolutions: std::collections::HashMap<PathBuf, planner::ConflictResolution>,
    db: State<'_, Db>,
) -> AppResult<Vec<OpResult>> {
    let results = executor::execute_plan(&items, &resolutions)?;
    let journal: Vec<JournalEntry> = results
        .iter()
        .filter_map(|r| {
            r.destination.as_ref().map(|dest| JournalEntry {
                from: r.path.clone(),
                to: dest.clone(),
            })
        })
        .collect();
    if !journal.is_empty() {
        record_operation(&db, "rename", &journal)?;
    }
    Ok(results)
}

fn record_operation(db: &State<'_, Db>, kind: &str, journal: &[JournalEntry]) -> AppResult<()> {
    let conn =
        db.0.lock()
            .map_err(|_| RenamiqError::user("Database busy"))?;
    let json = serde_json::to_string(journal)
        .map_err(|e| RenamiqError::with_source("Could not serialize journal", e))?;
    conn.execute(
        "INSERT INTO operations (kind, summary, status, undo_journal) VALUES (?1, ?2, 'completed', ?3)",
        rusqlite::params![kind, format!("{} file(s)", journal.len()), json],
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
                    .and_then(|j| serde_json::from_str::<Vec<JournalEntry>>(j).ok())
                    .map(|v| v.len())
                    .unwrap_or(0),
            })
        })
        .map_err(|e| RenamiqError::with_source("Could not read history", e))?;
    let items = rows.filter_map(Result::ok).collect();
    drop(stmt);
    Ok(items)
}

/// Undo the most recent reversible operation by replaying its journal
/// backwards. Only renames are journaled, so reversal is exact.
#[tauri::command]
pub fn undo_last_operation(db: State<'_, Db>) -> AppResult<String> {
    let (op_id, journal_json) = {
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
        match row {
            Some(pair) => pair,
            None => return Err(RenamiqError::user("Nothing to undo")),
        }
    };
    let journal: Vec<JournalEntry> = serde_json::from_str(&journal_json)
        .map_err(|e| RenamiqError::with_source("Undo journal is corrupted", e))?;

    let restored = executor::undo_journal(&journal)?;

    let conn =
        db.0.lock()
            .map_err(|_| RenamiqError::user("Database busy"))?;
    conn.execute(
        "UPDATE operations SET undo_journal = NULL WHERE id = ?1",
        [op_id],
    )
    .map_err(|e| RenamiqError::with_source("Could not update history", e))?;
    Ok(format!("Restored {restored} file(s)"))
}

// ── SETTINGS (key/value) ─────────────────────────────────────

#[tauri::command]
pub fn get_settings(db: State<'_, Db>) -> AppResult<HashMap<String, String>> {
    let conn =
        db.0.lock()
            .map_err(|_| RenamiqError::user("Database busy"))?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| RenamiqError::with_source("Could not read settings", e))?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| RenamiqError::with_source("Could not read settings", e))?;
    Ok(rows.filter_map(Result::ok).collect())
}

/// Upsert one setting. Values are plain strings; the frontend owns schemas.
#[tauri::command]
pub fn set_setting(
    key: String,
    value: String,
    db: State<'_, Db>,
) -> AppResult<()> {
    if key.is_empty() {
        return Err(RenamiqError::user("Setting key is empty"));
    }
    let conn =
        db.0.lock()
            .map_err(|_| RenamiqError::user("Database busy"))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(|e| RenamiqError::with_source("Could not save setting", e))?;
    Ok(())
}

// ── SUBKADE (SUBTITLE DOWNLOAD) ──────────────────────────────

#[tauri::command]
pub fn subkade_search(query: String, limit: Option<u8>) -> AppResult<Vec<crate::media::subkade::SubkadeResult>> {
    // Blocking HTTP in a command thread; Tauri spawns commands off the main thread.
    crate::media::subkade::search(&query, limit.unwrap_or(8))
}

#[tauri::command]
pub fn subkade_download(post_url: String, video_path: PathBuf) -> AppResult<Vec<PathBuf>> {
    let zip = crate::media::subkade::find_zip_link(&post_url)?;
    crate::media::subkade::download_and_extract(&zip, &video_path)
}
