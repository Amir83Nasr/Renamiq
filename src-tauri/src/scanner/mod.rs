use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::parser::{languages, parse_filename, ParsedMedia};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileRole {
    Video,
    Subtitle,
    Other,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub role: FileRole,
    pub parsed: Option<ParsedMedia>,
    pub subtitle_language: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub root: PathBuf,
    pub files: Vec<ScannedFile>,
    pub duration_ms: u64,
}

/// Extensions recognized as video. Lowercase, with dot.
const VIDEO_EXTS: &[&str] = &[
    ".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".ts",
    ".m2ts",
];

const SUBTITLE_EXTS: &[&str] = &[".srt", ".ass", ".ssa", ".sub", ".vtt"];

fn role_for(ext: &str) -> FileRole {
    if VIDEO_EXTS.contains(&ext) {
        FileRole::Video
    } else if SUBTITLE_EXTS.contains(&ext) {
        FileRole::Subtitle
    } else {
        FileRole::Other
    }
}

/// Scan a mix of file and folder paths. Files are added directly (if
/// video/subtitle), folders scanned recursively like [`scan_directory`].
/// `root` is the deepest shared parent so the planner can still organize
/// relative to a common base; falls back to the first path's parent.
pub fn scan_paths(paths: &[PathBuf]) -> std::io::Result<ScanResult> {
    let start = std::time::Instant::now();
    let mut files = Vec::new();
    for path in paths {
        if path.is_dir() {
            scan_recursive(path, &mut files, 0)?;
        } else if let Some(file) = scan_file(path)? {
            files.push(file);
        }
    }
    let root = paths
        .first()
        .and_then(|p| p.parent())
        .map(Path::to_path_buf)
        .unwrap_or_default();
    Ok(ScanResult {
        root,
        duration_ms: start.elapsed().as_millis() as u64,
        files,
    })
}

/// Build a `ScannedFile` for a single loose file. Returns `None` when the
/// role is `Other` or metadata is unavailable — same filtering as directory
/// scans.
fn scan_file(path: &Path) -> std::io::Result<Option<ScannedFile>> {
    let Some(name) = path.file_name().map(|n| n.to_string_lossy().into_owned()) else {
        return Ok(None);
    };
    if is_hidden(&name) {
        return Ok(None);
    }
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
        .unwrap_or_default();
    let role = role_for(&ext);
    if role == FileRole::Other {
        return Ok(None);
    }
    let parsed = match role {
        FileRole::Video => Some(parse_filename(&name)),
        FileRole::Subtitle | FileRole::Other => None,
    };
    let subtitle_language = if role == FileRole::Subtitle {
        extract_subtitle_language(&name)
    } else {
        None
    };
    let size_bytes = path.metadata().map(|m| m.len()).unwrap_or(0);
    Ok(Some(ScannedFile {
        path: path.to_path_buf(),
        name,
        extension: ext,
        size_bytes,
        role,
        parsed,
        subtitle_language,
    }))
}

/// Recursively scan `root` for media and subtitle files.
/// Skips hidden entries (dot-prefixed) and common junk dirs; unreadable
/// subdirs are skipped with a stderr note rather than failing the scan.
pub fn scan_directory(root: &Path) -> std::io::Result<ScanResult> {
    let start = std::time::Instant::now();
    let mut files = Vec::new();
    scan_recursive(root, &mut files, 0)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(ScanResult {
        root: root.to_path_buf(),
        duration_ms: start.elapsed().as_millis() as u64,
        files,
    })
}

const MAX_DEPTH: usize = 32;
const MAX_FILES: usize = 100_000;
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "$RECYCLE.BIN",
    "System Volume Information",
    "lost+found",
];

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn scan_recursive(dir: &Path, out: &mut Vec<ScannedFile>, depth: usize) -> std::io::Result<()> {
    if depth > MAX_DEPTH || out.len() > MAX_FILES {
        return Ok(()); // safety valve against pathological trees
    }
    let mut entries: Vec<std::fs::DirEntry> = match std::fs::read_dir(dir) {
        Ok(rd) => rd.filter_map(Result::ok).collect(),
        Err(err) => {
            eprintln!("[renamiq] skipping unreadable dir {}: {err}", dir.display());
            return Ok(());
        }
    };
    entries.sort_by_key(|e| e.file_name()); // deterministic order

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if is_hidden(&name) || SKIP_DIRS.iter().any(|s| name.eq_ignore_ascii_case(s)) {
                continue;
            }
            scan_recursive(&path, out, depth + 1)?;
        } else if !is_hidden(&name) {
            let ext = path
                .extension()
                .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
                .unwrap_or_default();
            let role = role_for(&ext);
            if role == FileRole::Other {
                continue;
            }
            let parsed = match role {
                FileRole::Video => Some(parse_filename(&name)),
                FileRole::Subtitle | FileRole::Other => None,
            };
            let subtitle_language = if role == FileRole::Subtitle {
                extract_subtitle_language(&name)
            } else {
                None
            };
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(ScannedFile {
                path,
                name,
                extension: ext,
                size_bytes,
                role,
                parsed,
                subtitle_language,
            });
        }
    }
    Ok(())
}

/// "Movie.fa.srt" → Some("fa"); "Movie.srt" → Persian default (see languages).
pub fn extract_subtitle_language(filename: &str) -> Option<String> {
    let stem = filename.rsplit_once('.').map_or(filename, |(s, _)| s);
    let token = stem.rsplit(['.', '_', ' ', '-']).next();
    languages::canonical_language(token).map(|c| c.to_string())
}
