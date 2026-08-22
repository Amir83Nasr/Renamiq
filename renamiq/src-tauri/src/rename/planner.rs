//! Rename plan generation: scan results → deterministic operation list.
//! Collision detection happens at plan time so preview shows problems
//! before anything touches the disk.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::parser::{MediaKind, ParsedMedia};
use crate::rename::templates::{default_template, render_template};
use crate::scanner::ScannedFile;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OpKind {
    Rename,
    Move,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedOp {
    pub id: String,
    pub kind: OpKind,
    pub source: PathBuf,
    pub destination: PathBuf,
    /// Destination already exists on disk (needs user decision).
    pub collides_on_disk: bool,
    /// Two planned ops target the same path (second is a collision).
    pub duplicate_in_plan: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePlan {
    pub root: PathBuf,
    pub ops: Vec<PlannedOp>,
    pub skipped: Vec<SkippedFile>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedFile {
    pub path: PathBuf,
    pub reason: String,
}

/// Build a rename/move plan for parsed files under `root`.
///
/// `organize_into_folders`: also produce destination directories
/// (Movies/<title>/, TV Shows/<title>/Season NN/) relative to `root`.
/// Subtitles follow their matched video (same stem + language suffix).
pub fn build_plan(root: &Path, files: &[ScannedFile], organize: bool) -> RenamePlan {
    let mut ops: Vec<PlannedOp> = Vec::new();
    let mut skipped: Vec<SkippedFile> = Vec::new();
    let mut seq = 0u32;

    for file in files {
        match &file.parsed {
            Some(parsed) if file.role == crate::scanner::FileRole::Video => {
                if parsed.kind == MediaKind::Unknown || parsed.title.is_empty() {
                    skipped.push(SkippedFile {
                        path: file.path.clone(),
                        reason: "Could not detect title".into(),
                    });
                    continue;
                }
                if let Some(dest) = destination_for(root, parsed, &file.name, organize) {
                    if dest != file.path {
                        seq += 1;
                        ops.push(PlannedOp {
                            id: format!("op-{seq}"),
                            kind: op_kind(&file.path, &dest),
                            source: file.path.clone(),
                            destination: dest,
                            collides_on_disk: false,
                            duplicate_in_plan: false,
                        });
                    }
                }
            }
            _ => {} // subtitles handled after videos are planned
        }
    }

    // Subtitle files: attach to the nearest video plan by stem prefix.
    for file in files.iter().filter(|f| f.role == crate::scanner::FileRole::Subtitle) {
        if let Some(dest) = subtitle_destination(root, files, &ops, file, organize) {
            if dest != file.path {
                seq += 1;
                ops.push(PlannedOp {
                    id: format!("op-{seq}"),
                    kind: op_kind(&file.path, &dest),
                    source: file.path.clone(),
                    destination: dest,
                    collides_on_disk: false,
                    duplicate_in_plan: false,
                });
            }
        }
    }

    // Collision flags: on-disk and in-plan duplicates.
    let mut dup_dests: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
    {
        let mut seen: std::collections::HashSet<&PathBuf> = std::collections::HashSet::new();
        for op in &ops {
            if !seen.insert(&op.destination) {
                dup_dests.insert(op.destination.clone());
            }
        }
    }
    for op in ops.iter_mut() {
        op.collides_on_disk = op.destination.exists();
        op.duplicate_in_plan = dup_dests.contains(&op.destination);
    }

    RenamePlan {
        root: root.to_path_buf(),
        ops,
        skipped,
    }
}

fn op_kind(src: &Path, dest: &Path) -> OpKind {
    if src.parent() == dest.parent() {
        OpKind::Rename
    } else {
        OpKind::Move
    }
}

/// Compute the destination path for one video according to templates.
fn destination_for(
    root: &Path,
    parsed: &ParsedMedia,
    original_name: &str,
    organize: bool,
) -> Option<PathBuf> {
    let ext = Path::new(original_name)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let new_name = format!("{}{}", render_template(default_template(parsed.kind), parsed), ext);

    if !organize {
        return Some(root.join(new_name));
    }
    let dir = match parsed.kind {
        MediaKind::Movie => root.join("Movies").join(safe_dir(&parsed.title)),
        MediaKind::Tv => root
            .join("TV Shows")
            .join(safe_dir(&parsed.title))
            .join(format!("Season {:02}", parsed.season.unwrap_or(1))),
        MediaKind::Unknown => return None,
    };
    Some(dir.join(new_name))
}

fn safe_dir(title: &str) -> String {
    templates_sanitize(title)
}

fn templates_sanitize(s: &str) -> String {
    crate::rename::templates::sanitize_filename(s)
}

/// Find the matching video op for a subtitle by comparing cleaned stems.
fn subtitle_destination(
    root: &Path,
    files: &[ScannedFile],
    ops: &[PlannedOp],
    sub: &ScannedFile,
    organize: bool,
) -> Option<PathBuf> {
    let sub_stem = stem_of(&sub.name);
    // Strip language token from the subtitle stem for comparison.
    let sub_base = sub_stem
        .rsplit(['.', '_', ' ', '-'])
        .next()
        .map(|tok| {
            let cut = sub_stem.len() - tok.len();
            sub_stem[..cut].trim_end_matches(['.', '_', ' ', '-']).to_string()
        })
        .unwrap_or_else(|| sub_stem.clone());

    // Match against scanned videos by normalized base stem.
    let lang_suffix = sub
        .subtitle_language
        .as_deref()
        .unwrap_or("fa")
        .to_string();

    for video in files.iter().filter(|f| f.role == crate::scanner::FileRole::Video) {
        if stems_match(&stem_of(&video.name), &sub_base) {
            // Find that video's planned destination to mirror it.
            let dest_video = ops
                .iter()
                .find(|op| op.source == video.path)
                .map(|op| op.destination.clone())
                .unwrap_or_else(|| video.path.clone());
            let dir = if organize {
                dest_video.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| root.to_path_buf())
            } else {
                root.to_path_buf()
            };
            let new_stem = stem_of(&dest_video.file_name()?.to_string_lossy());
            return Some(dir.join(format!("{new_stem}.{lang_suffix}.srt")));
        }
    }
    None
}

/// Normalized-stem similarity: equal ignoring case/separators, or one is a
/// prefix of the other (handles "Show.S01E01" vs "Show.S01E01.1080p").
fn stems_match(video_stem: &str, sub_stem: &str) -> bool {
    let norm = |s: &str| s.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect::<String>();
    let (a, b) = (norm(video_stem), norm(sub_stem));
    if a.is_empty() || b.is_empty() {
        return false;
    }
    a == b || a.starts_with(b.as_str()) || b.starts_with(a.as_str())
}

fn stem_of(filename: &str) -> String {
    filename
        .rsplit_once('.')
        .map_or(filename.to_string(), |(s, _)| s.to_string())
}
