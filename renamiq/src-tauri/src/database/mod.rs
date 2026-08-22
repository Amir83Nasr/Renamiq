//! SQLite persistence with embedded migrations. One connection per app,
//! opened lazily and stored in Tauri state.

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use crate::core::error::{AppResult, RenamiqError};

pub struct Db(pub Mutex<Connection>);

const MIGRATIONS: &[&str] = &[
    // v1: initial schema
    "
    CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE libraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        last_scanned_at TEXT
    );
    CREATE TABLE media_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        path TEXT NOT NULL UNIQUE,
        kind TEXT CHECK (kind IN ('movie','tv','unknown')),
        title TEXT,
        year INTEGER,
        season INTEGER,
        episode INTEGER,
        size_bytes INTEGER,
        scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE subtitle_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_file_id INTEGER REFERENCES media_files(id) ON DELETE CASCADE,
        path TEXT NOT NULL UNIQUE,
        language TEXT
    );
    CREATE TABLE operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('completed','failed','partial')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        undo_journal TEXT -- JSON array of {from,to} for reversal
    );
    CREATE INDEX idx_media_library ON media_files(library_id);
    ",
];

pub fn open(db_path: &Path) -> AppResult<Db> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| RenamiqError::with_source("Could not create data folder", e))?;
    }
    let conn = Connection::open(db_path)
        .map_err(|e| RenamiqError::with_source("Could not open database", e))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| RenamiqError::with_source("Could not configure database", e))?;
    migrate(&conn)?;
    Ok(Db(Mutex::new(conn)))
}

fn migrate(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')));",
    )
    .map_err(|e| RenamiqError::with_source("Migration bookkeeping failed", e))?;

    let current: i64 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM _migrations", [], |r| r.get(0))
        .map_err(|e| RenamiqError::with_source("Could not read migrations", e))?;

    for (i, sql) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i64;
        if version > current {
            conn.execute_batch(sql)
                .map_err(|e| RenamiqError::with_source(format!("Migration {version} failed"), e))?;
            conn.execute("INSERT INTO _migrations (version) VALUES (?1)", [version])
                .map_err(|e| RenamiqError::with_source("Migration bookkeeping failed", e))?;
        }
    }
    Ok(())
}

/// Default DB location: <app-data>/renamiq.db.
pub fn default_db_path(app_data: &Path) -> std::path::PathBuf {
    app_data.join("renamiq.db")
}
