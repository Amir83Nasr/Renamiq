//! Operation history: the single place that reads/writes the `operations`
//! table. `item_count` is stored at insert time so the row keeps its size
//! after undo clears the journal.

use rusqlite::Connection;
use serde::Serialize;

use crate::core::error::{AppResult, RenamiqError};
use crate::rename::executor::JournalEntry;

/// One history row as the UI consumes it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationRecord {
    pub id: i64,
    pub kind: String,
    pub summary: String,
    pub status: String,
    pub created_at: String,
    /// Set once the operation has been reverted; `None` while still applied.
    pub undone_at: Option<String>,
    /// False after undo (journal consumed) or when nothing was journaled.
    pub can_undo: bool,
    pub item_count: i64,
}

/// Insert one operation. `journal` may be empty — a fully failed batch is
/// still worth showing in history, it just cannot be undone.
pub fn record(
    conn: &Connection,
    kind: &str,
    status: &str,
    summary: &str,
    journal: &[JournalEntry],
) -> AppResult<i64> {
    let journal_json = if journal.is_empty() {
        None
    } else {
        Some(
            serde_json::to_string(journal)
                .map_err(|e| RenamiqError::with_source("Could not serialize journal", e))?,
        )
    };
    conn.execute(
        "INSERT INTO operations (kind, summary, status, undo_journal, item_count)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![kind, summary, status, journal_json, journal.len() as i64],
    )
    .map_err(|e| RenamiqError::with_source("Could not save operation history", e))?;
    Ok(conn.last_insert_rowid())
}

/// Newest first. Rows that fail to map are an error, not silently dropped —
/// a half-empty history page is worse than a visible failure.
pub fn list(conn: &Connection, limit: i64) -> AppResult<Vec<OperationRecord>> {
    let mut stmt = conn
        .prepare(
            "SELECT id, kind, summary, status, created_at, undone_at, item_count,
                    undo_journal IS NOT NULL
             FROM operations ORDER BY id DESC LIMIT ?1",
        )
        .map_err(|e| RenamiqError::with_source("Could not read history", e))?;
    let rows = stmt
        .query_map([limit], |r| {
            Ok(OperationRecord {
                id: r.get(0)?,
                kind: r.get(1)?,
                summary: r.get(2)?,
                status: r.get(3)?,
                created_at: r.get(4)?,
                undone_at: r.get(5)?,
                item_count: r.get(6)?,
                can_undo: r.get(7)?,
            })
        })
        .map_err(|e| RenamiqError::with_source("Could not read history", e))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| RenamiqError::with_source("Could not read history", e))
}

/// The newest still-reversible operation, if any.
pub fn last_undoable(conn: &Connection) -> AppResult<Option<(i64, Vec<JournalEntry>)>> {
    let row: Option<(i64, String)> = conn
        .query_row(
            "SELECT id, undo_journal FROM operations
             WHERE undo_journal IS NOT NULL ORDER BY id DESC LIMIT 1",
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
        None => Ok(None),
        Some((id, json)) => {
            let journal: Vec<JournalEntry> = serde_json::from_str(&json)
                .map_err(|e| RenamiqError::with_source("Undo journal is corrupted", e))?;
            Ok(Some((id, journal)))
        }
    }
}

/// Consume the journal and stamp the revert time; `item_count` is untouched.
pub fn mark_undone(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute(
        "UPDATE operations SET undo_journal = NULL, undone_at = datetime('now') WHERE id = ?1",
        [id],
    )
    .map_err(|e| RenamiqError::with_source("Could not update history", e))?;
    Ok(())
}
