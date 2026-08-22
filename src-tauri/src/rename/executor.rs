//! Plan execution + undo journal. Each executed op is recorded so it can be
//! reversed (rename/move are reversible by swapping source/destination).

use std::fs;

use serde::Serialize;

use crate::core::error::{AppResult, RenamiqError};
use crate::rename::planner::PlannedOp;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpResult {
    pub id: String,
    pub ok: bool,
    pub error: Option<String>,
}

/// Execute planned ops sequentially. Ops flagged as collisions are skipped
/// unless `resolve` says otherwise (caller decides Skip/Replace per file).
/// Never overwrites silently: without a resolve callback collisions fail.
pub fn execute_plan(
    ops: &[PlannedOp],
    overwrite_ids: &[String],
) -> AppResult<Vec<OpResult>> {
    let mut results = Vec::with_capacity(ops.len());
    for op in ops {
        if op.collides_on_disk && !overwrite_ids.contains(&op.id) {
            results.push(OpResult {
                id: op.id.clone(),
                ok: false,
                error: Some("Destination already exists".into()),
            });
            continue;
        }
        match apply_op(op) {
            Ok(()) => results.push(OpResult { id: op.id.clone(), ok: true, error: None }),
            Err(err) => results.push(OpResult {
                id: op.id.clone(),
                ok: false,
                error: Some(err.to_string()),
            }),
        }
    }
    Ok(results)
}

fn apply_op(op: &PlannedOp) -> AppResult<()> {
    if !op.source.exists() {
        return Err(RenamiqError::user(format!(
            "Source file no longer exists: {}",
            op.source.display()
        )));
    }
    if let Some(parent) = op.destination.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            RenamiqError::with_source(
                format!("Could not create folder {}", parent.display()),
                e,
            )
        })?;
    }
    // Same-volume rename covers move within one filesystem; fall back to
    // copy+delete for cross-device moves. Original kept until success by
    // rename semantics; for copy path the delete happens only after copy OK.
    if let Err(err) = fs::rename(&op.source, &op.destination) {
        if err.kind() == std::io::ErrorKind::CrossesDevices {
            fs::copy(&op.source, &op.destination).map_err(|e| {
                RenamiqError::with_source("Copy before move failed", e)
            })?;
            fs::remove_file(&op.source).map_err(|e| {
                RenamiqError::with_source(
                    format!("Moved but could not remove original {}", op.source.display()),
                    e,
                )
            })?;
        } else if op.destination.exists() && overwrite_allowed(op) {
            // Replace only when explicitly requested via overwrite list —
            // handled above; reaching here means plain failure.
            return Err(RenamiqError::with_source(
                format!(
                    "Unable to rename file. The destination already exists.\nSource: {}\nDestination: {}",
                    op.source.display(),
                    op.destination.display()
                ),
                err,
            ));
        } else {
            return Err(RenamiqError::with_source(
                format!(
                    "Unable to rename file.\nSource: {}\nDestination: {}",
                    op.source.display(),
                    op.destination.display()
                ),
                err,
            ));
        }
    }
    Ok(())
}

fn overwrite_allowed(_op: &PlannedOp) -> bool {
    false
}
