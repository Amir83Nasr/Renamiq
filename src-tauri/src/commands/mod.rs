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

#[tauri::command]
pub fn remove_subtitle(video: String) -> AppResult<String> {
    let path = std::path::PathBuf::from(&video);
    crate::media::remove_subs::remove_subtitles(&path).map(|p| p.to_string_lossy().into_owned())
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
pub fn set_setting(key: String, value: String, db: State<'_, Db>) -> AppResult<()> {
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
pub async fn subkade_search(
    query: String,
    limit: Option<u8>,
) -> AppResult<Vec<crate::media::subkade::SubkadeResult>> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::media::subkade::search(&query, limit.unwrap_or(8))
    })
    .await
    .map_err(|e| RenamiqError::with_source("Search task failed", e))?
}

#[tauri::command]
pub async fn subkade_download(
    post_url: String,
    video_path: PathBuf,
    app: tauri::AppHandle,
) -> AppResult<Vec<PathBuf>> {
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move || {
        let zip = crate::media::subkade::find_zip_link(&post_url)?;
        let total = crate::media::subkade::zip_size(&zip).unwrap_or(0);
        crate::media::subkade::download_and_extract(&zip, &video_path, |downloaded| {
            let _ = app.emit(
                "subkade-progress",
                serde_json::json!({
                    "url": post_url,
                    "downloaded": downloaded,
                    "total": total,
                }),
            );
        })
    })
    .await
    .map_err(|e| RenamiqError::with_source("Download task failed", e))?
}

/// Standalone download: extracts subtitles straight into a folder.
/// Emits `subkade-progress` events with `{ url, downloaded, total }` while the
/// zip streams; `total` is 0 when the server omits Content-Length.
/// Returns (extracted files, zip size in bytes).
#[tauri::command]
pub async fn subkade_download_to_folder(
    post_url: String,
    dest_dir: PathBuf,
    subfolder: Option<String>,
    app: tauri::AppHandle,
) -> AppResult<(Vec<PathBuf>, u64)> {
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move || {
        let zip = crate::media::subkade::find_zip_link(&post_url)?;
        let size = crate::media::subkade::zip_size(&zip).unwrap_or(0);
        let sub = subfolder.unwrap_or_default();
        let files = crate::media::subkade::download_to_dir(&zip, &dest_dir, &sub, |downloaded| {
            let _ = app.emit(
                "subkade-progress",
                serde_json::json!({
                    "url": post_url,
                    "downloaded": downloaded,
                    "total": size,
                }),
            );
        })?;
        Ok((files, size))
    })
    .await
    .map_err(|e| RenamiqError::with_source("Download task failed", e))?
}

/// Pre-fetch the zip byte length for a post URL so the UI can display the
/// archive size before the user clicks download.
#[tauri::command]
pub async fn subkade_zip_size(post_url: String) -> AppResult<u64> {
    tauri::async_runtime::spawn_blocking(move || {
        let zip = crate::media::subkade::find_zip_link(&post_url)?;
        crate::media::subkade::zip_size(&zip)
    })
    .await
    .map_err(|e| RenamiqError::with_source("Zip size check failed", e))?
}

// ── EMBED (SUBTITLE MUXING) ──────────────────────────────────

#[tauri::command]
pub async fn embed_subtitle(
    video: PathBuf,
    subtitle: PathBuf,
    language: Option<String>,
) -> AppResult<PathBuf> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::media::embed::embed(&crate::media::embed::EmbedRequest {
            video,
            subtitle,
            language: language.unwrap_or_else(|| "per".into()),
        })
    })
    .await
    .map_err(|e| RenamiqError::with_source("Embedding task failed", e))?
}

// ── TMDB (POSTER SEARCH/DOWNLOAD) ────────────────────────────

#[tauri::command]
pub async fn tmdb_search(
    query: String,
    api_key: String,
    limit: Option<u8>,
) -> AppResult<Vec<crate::media::tmdb::TmdbResult>> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::media::tmdb::search(&query, &api_key, limit.unwrap_or(8))
    })
    .await
    .map_err(|e| RenamiqError::with_source("Search task failed", e))?
}

#[tauri::command]
pub async fn tmdb_download_poster(
    result: crate::media::tmdb::TmdbResult,
    api_key: String,
    dest_dir: PathBuf,
    app: tauri::AppHandle,
) -> AppResult<PathBuf> {
    use tauri::Emitter;
    tauri::async_runtime::spawn_blocking(move || {
        let id = result.id;
        crate::media::tmdb::download_poster(&result, &api_key, &dest_dir, |downloaded, total| {
            let _ = app.emit(
                "poster-progress",
                serde_json::json!({
                    "id": id,
                    "downloaded": downloaded,
                    "total": total,
                }),
            );
        })
    })
    .await
    .map_err(|e| RenamiqError::with_source("Download task failed", e))?
}
