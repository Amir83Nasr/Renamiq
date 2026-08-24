//! Rename plan generation: scan results + user edits → per-file plan items.
//! Each item carries a status (ready / needs_review / error / conflict) so
//! the UI can show exactly what will happen before anything touches disk.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::parser::{MediaKind, ParsedMedia};
use crate::rename::templates::{default_template, render_template, sanitize_filename};
use crate::scanner::ScannedFile;

/// Per-file outcome, computed at plan time. Drives the UI status column.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ItemStatus {
    /// Confident parse; safe to rename.
    Ready,
    /// Ambiguous detection (missing episode/year, low confidence title).
    NeedsReview,
    /// No valid rename possible (no type, empty name).
    Error,
    /// Destination exists on disk or duplicates another item in the batch.
    Conflict,
}

/// How the user wants to handle an on-disk destination collision.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConflictResolution {
    Skip,
    Replace,
    Suffix,
}

/// User override for one file. `None` fields fall back to parsed values;
/// `custom_name` bypasses templates entirely.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FileOverride {
    pub kind: Option<MediaKind>,
    pub title: Option<String>,
    pub year: Option<u16>,
    pub season: Option<u8>,
    pub episode: Option<u8>,
    pub custom_name: Option<String>,
    pub exclude: bool,
}

/// One file in the rename plan: source, proposed destination, status.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub path: PathBuf,
    /// Original filename with extension.
    pub original_name: String,
    /// Proposed new filename with extension.
    pub new_name: String,
    /// Destination directory (equals source dir when not organizing).
    pub directory: PathBuf,
    /// Full destination = directory / new_name.
    pub destination: PathBuf,
    pub kind: MediaKind,
    pub season: Option<u8>,
    pub episode: Option<u8>,
    pub year: Option<u16>,
    pub status: ItemStatus,
    /// Machine-readable reason codes; the frontend translates them.
    pub warnings: Vec<String>,
}

/// Input to plan building sent from the frontend.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanRequest {
    /// Common base directory used when organizing into folders.
    pub root: PathBuf,
    pub files: Vec<ScannedFile>,
    /// Organize into Movies/ and TV Shows/ folder structure.
    pub organize: bool,
    /// Per-file overrides keyed by path.
    #[serde(default)]
    pub overrides: HashMap<PathBuf, FileOverride>,
    /// Per-file conflict resolutions keyed by path.
    #[serde(default)]
    pub resolutions: HashMap<PathBuf, ConflictResolution>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePlan {
    pub items: Vec<PlanItem>,
    /// Items the user may execute right now (ready or resolved conflicts).
    pub ready_count: usize,
}

/// Metadata after merging an override on top of the parse.
struct EffectiveMeta {
    kind: MediaKind,
    title: String,
    year: Option<u16>,
    season: Option<u8>,
    episode: Option<u8>,
}

fn effective(parsed: &ParsedMedia, ovr: &FileOverride) -> EffectiveMeta {
    EffectiveMeta {
        kind: ovr.kind.unwrap_or(parsed.kind),
        title: ovr
            .title
            .as_deref()
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .map_or(parsed.title.clone(), str::to_string),
        year: ovr.year.or(parsed.year),
        season: ovr.season.or(parsed.season),
        episode: ovr.episode.or(parsed.episode),
    }
}

/// Build the plan. Touches the filesystem only for existence checks.
pub fn build_plan(req: &PlanRequest) -> RenamePlan {
    let mut items: Vec<PlanItem> = Vec::new();

    for file in &req.files {
        if file.role != crate::scanner::FileRole::Video {
            continue; // ponytail: subtitle planning rides along in a later milestone
        }
        let ovr = req.overrides.get(&file.path).cloned().unwrap_or_default();
        if ovr.exclude {
            continue;
        }
        let item = build_item(req, file, &ovr);
        // Already correctly named → nothing to do, drop from the plan.
        if norm_key(&item.destination) != norm_key(&item.path) {
            items.push(item);
        }
    }

    // Duplicate-destination detection across the whole batch.
    let mut seen: HashSet<String> = HashSet::new();
    let mut dupes: HashSet<String> = HashSet::new();
    for item in &items {
        let key = norm_key(&item.destination);
        if !seen.insert(key.clone()) {
            dupes.insert(key);
        }
    }

    let mut ready_count = 0usize;
    for item in &mut items {
        if item.status == ItemStatus::Error {
            continue;
        }
        let dupe = dupes.contains(&norm_key(&item.destination));
        let dest_exists = item.destination.exists() && !is_same_file(&item.path, &item.destination);
        if dupe {
            item.status = ItemStatus::Conflict;
            item.warnings.push("duplicate".into());
        } else if dest_exists {
            match req
                .resolutions
                .get(&item.path)
                .unwrap_or(&ConflictResolution::Skip)
            {
                ConflictResolution::Replace => {
                    item.warnings.push("replace".into());
                    ready_count += 1;
                }
                ConflictResolution::Suffix => {
                    apply_suffix(item);
                    ready_count += 1;
                }
                ConflictResolution::Skip => {
                    item.status = ItemStatus::Conflict;
                    item.warnings.push("exists".into());
                }
            }
        } else if item.status == ItemStatus::Ready {
            ready_count += 1;
        } else if item.status == ItemStatus::NeedsReview && !item.warnings.is_empty() {
            // Needs-review items are executable once the user fixes them;
            // they don't count as ready.
        }
    }

    RenamePlan { items, ready_count }
}

fn build_item(req: &PlanRequest, file: &ScannedFile, ovr: &FileOverride) -> PlanItem {
    let parsed = file
        .parsed
        .clone()
        .unwrap_or_else(|| unknown_parse(&file.name));
    let meta = effective(&parsed, ovr);

    let mut warnings: Vec<String> = Vec::new();
    let mut status = ItemStatus::Ready;

    // Custom name short-circuits template generation.
    let stem = if let Some(custom) = ovr.custom_name.as_deref().map(str::trim) {
        if custom.is_empty() {
            status = ItemStatus::Error;
            warnings.push("empty".into());
            String::new()
        } else {
            sanitize_filename(custom)
        }
    } else {
        match meta.kind {
            MediaKind::Unknown => {
                status = ItemStatus::Error;
                warnings.push("notype".into());
                String::new()
            }
            MediaKind::Movie => {
                let stem = render_stem(MediaKind::Movie, &meta);
                if meta.title.is_empty() {
                    status = ItemStatus::NeedsReview;
                    warnings.push("notitle".into());
                }
                if meta.year.is_none() {
                    status = ItemStatus::NeedsReview;
                    warnings.push("noyear".into());
                }
                stem
            }
            MediaKind::Tv => {
                let stem = render_stem(MediaKind::Tv, &meta);
                if meta.title.is_empty() {
                    status = ItemStatus::NeedsReview;
                    warnings.push("notitle".into());
                }
                if meta.season.is_none() || meta.episode.is_none() {
                    status = ItemStatus::NeedsReview;
                    warnings.push("nosxe".into());
                }
                stem
            }
        }
    };

    // Parser was unsure about the title and user didn't override it.
    if status == ItemStatus::Ready && parsed.low_confidence && ovr.title.is_none() {
        status = ItemStatus::NeedsReview;
        warnings.push("unsure".into());
    }

    let ext = extension_of(&file.name);
    let new_name = format!("{stem}{ext}");
    let directory = directory_for(req, file, meta.kind, &meta.title, meta.season);
    let mut destination = directory.join(&new_name);
    if stem.is_empty() {
        // Error state: point destination at source so nothing can execute.
        destination = file.path.clone();
    }

    PlanItem {
        path: file.path.clone(),
        original_name: file.name.clone(),
        new_name,
        directory,
        destination,
        kind: meta.kind,
        season: meta.season,
        episode: meta.episode,
        year: meta.year,
        status,
        warnings,
    }
}

fn render_stem(kind: MediaKind, m: &EffectiveMeta) -> String {
    let parsed = ParsedMedia {
        filename: String::new(),
        kind,
        title: m.title.clone(),
        year: m.year,
        season: m.season,
        episode: m.episode,
        episodes: None,
        resolution: None,
        codec: None,
        audio: None,
        language: None,
        group: None,
        edition: None,
        low_confidence: false,
    };
    render_template(default_template(kind), &parsed)
}

/// Destination directory: source's parent when flat; Movies/TV Shows tree
/// rooted at the scan's common base when organizing.
fn directory_for(
    req: &PlanRequest,
    file: &ScannedFile,
    kind: MediaKind,
    title: &str,
    season: Option<u8>,
) -> PathBuf {
    let flat = file
        .path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    if !req.organize || req.root.as_os_str().is_empty() {
        return flat;
    }
    match kind {
        MediaKind::Movie => req.root.join("Movies").join(sanitize_filename(title)),
        MediaKind::Tv => req
            .root
            .join("TV Shows")
            .join(sanitize_filename(title))
            .join(
                season
                    .map(|s| format!("Season {s:02}"))
                    .unwrap_or_else(|| "Season 01".into()),
            ),
        MediaKind::Unknown => flat,
    }
}

fn is_same_file(a: &Path, b: &Path) -> bool {
    norm_key(a) == norm_key(b)
}

fn extension_of(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if i > 0 && i < name.len() - 1 => name[i..].to_lowercase(),
        _ => String::new(),
    }
}

fn unknown_parse(name: &str) -> ParsedMedia {
    ParsedMedia {
        filename: name.to_string(),
        kind: MediaKind::Unknown,
        title: String::new(),
        year: None,
        season: None,
        episode: None,
        episodes: None,
        resolution: None,
        codec: None,
        audio: None,
        language: None,
        group: None,
        edition: None,
        low_confidence: true,
    }
}

/// Case-insensitive path key for duplicate detection.
fn norm_key(p: &Path) -> String {
    p.to_string_lossy().to_lowercase()
}

/// "Movie 2019.mkv" exists → try "Movie 2019 (2).mkv", "(3)", …
fn apply_suffix(item: &mut PlanItem) {
    let ext = extension_of(&item.new_name);
    let stem = item.new_name.strip_suffix(&ext).unwrap_or(&item.new_name);
    for n in 2..1000u32 {
        let name = format!("{stem} ({n}){ext}");
        let candidate = item.directory.join(&name);
        if !candidate.exists() {
            item.new_name = name;
            item.destination = candidate;
            return;
        }
    }
}
