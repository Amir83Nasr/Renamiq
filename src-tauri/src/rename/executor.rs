//! Plan execution + undo journal. Each executed op is recorded with its
//! ACTUAL destination so reversal is exact even after suffix/replace.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::core::error::{AppResult, RenamiqError};
use crate::rename::planner::{ConflictResolution, PlanItem};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpResult {
    pub path: PathBuf,
    pub ok: bool,
    /// Actual destination on success (may differ after suffix resolution).
    pub destination: Option<PathBuf>,
    pub error: Option<String>,
}

/// Execute ready items sequentially. Items whose status is error/conflict
/// are refused; `replace` items carry an explicit user resolution.
pub fn execute_plan(
    items: &[PlanItem],
    resolutions: &std::collections::HashMap<PathBuf, ConflictResolution>,
) -> AppResult<Vec<OpResult>> {
    let mut results = Vec::with_capacity(items.len());
    for item in items {
        if item.status == crate::rename::planner::ItemStatus::Error
            || item.status == crate::rename::planner::ItemStatus::Conflict
        {
            continue;
        }
        let replacing = item.warnings.iter().any(|w| w == "replace")
            && resolutions.get(&item.path) == Some(&ConflictResolution::Replace);
        results.push(apply_item(item, replacing));
    }
    Ok(results)
}

fn apply_item(item: &PlanItem, replace: bool) -> OpResult {
    let base = |error: String| OpResult {
        path: item.path.clone(),
        ok: false,
        destination: None,
        error: Some(error),
    };

    if !item.source_exists() {
        return base("The original file could not be found.".into());
    }
    if item.destination.exists() && !replace {
        return base("Destination already exists.".into());
    }
    if let Some(parent) = item.destination.parent() {
        if let Err(err) = fs::create_dir_all(parent) {
            return base(format!("Could not create folder {}.", parent.display())).with_source(err);
        }
    }
    match fs::rename(&item.path, &item.destination) {
        Ok(()) => OpResult {
            path: item.path.clone(),
            ok: true,
            destination: Some(item.destination.clone()),
            error: None,
        },
        Err(err) => base("Unable to rename this file.".into()).with_source(err),
    }
}

trait SourceCheck {
    fn source_exists(&self) -> bool;
}
impl SourceCheck for PlanItem {
    fn source_exists(&self) -> bool {
        self.path.exists()
    }
}

trait WithSource {
    fn with_source(self, err: std::io::Error) -> OpResult;
}
impl WithSource for OpResult {
    fn with_source(mut self, err: std::io::Error) -> OpResult {
        log::warn!("rename failed: {err}");
        self.error = Some("Unable to rename this file.".into());
        self
    }
}

/// Journal entry persisted for undo: actual from → to.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JournalEntry {
    pub from: PathBuf,
    pub to: PathBuf,
}

/// Reverse a journal (newest first). Returns how many files were restored.
pub fn undo_journal(journal: &[JournalEntry]) -> AppResult<usize> {
    let mut undone = 0usize;
    for entry in journal.iter().rev() {
        if !entry.to.exists() {
            continue;
        }
        if let Some(parent) = entry.from.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::rename(&entry.to, &entry.from)
            .map_err(|e| RenamiqError::with_source("Could not restore the files.", e))?;
        undone += 1;
    }
    Ok(undone)
}
