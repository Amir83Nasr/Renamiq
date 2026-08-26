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
    /// Subtitle language code override (e.g. "fa").
    pub language: Option<String>,
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
    /// Canonical subtitle language when this item is a subtitle sidecar.
    pub language: Option<String>,
    /// Path of the video this subtitle is attached to (same stem).
    pub video_path: Option<PathBuf>,
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
    /// Configured destination roots for movies/series; None = defaults.
    #[serde(default)]
    pub destinations: Option<Destinations>,
    /// Custom naming templates; missing/empty falls back to defaults.
    #[serde(default)]
    pub templates: Option<PlanTemplates>,
    /// Move subtitles alongside their video when organizing (default true).
    #[serde(default)]
    pub include_subtitles: Option<bool>,
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

/// User-configurable naming templates (settings page).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PlanTemplates {
    pub movie: String,
    pub tv: String,
}

impl Default for PlanTemplates {
    fn default() -> Self {
        Self {
            movie: default_template(MediaKind::Movie).to_string(),
            tv: default_template(MediaKind::Tv).to_string(),
        }
    }
}

/// User-configurable destination roots for organizing (settings page).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Destinations {
    #[serde(default)]
    pub movie: PathBuf,
    #[serde(default)]
    pub tv: PathBuf,
}

/// Metadata after merging an override on top of the parse.
struct EffectiveMeta {
    kind: MediaKind,
    title: String,
    year: Option<u16>,
    season: Option<u8>,
    episode: Option<u8>,
    /// Extra episodes for multi-episode files (S01E01E02 → [1, 2, 3]).
    /// Dropped when the user overrides the episode number manually.
    episodes: Option<Vec<u8>>,
    resolution: Option<String>,
    codec: Option<String>,
    audio: Option<String>,
    group: Option<String>,
    edition: Option<String>,
}

fn effective(parsed: &ParsedMedia, ovr: &FileOverride) -> EffectiveMeta {
    // A manual episode fix makes the parsed multi-episode range stale.
    let episodes = if ovr.episode.is_some() {
        None
    } else {
        parsed.episodes.clone()
    };
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
        episodes,
        resolution: parsed.resolution.clone(),
        codec: parsed.codec.clone(),
        audio: parsed.audio.clone(),
        group: parsed.group.clone(),
        edition: parsed.edition.clone(),
    }
}

/// Build the plan. Touches the filesystem only for existence checks.
pub fn build_plan(req: &PlanRequest) -> RenamePlan {
    let mut items: Vec<PlanItem> = Vec::new();
    let videos: Vec<ScannedFile> = req
        .files
        .iter()
        .filter(|f| f.role == crate::scanner::FileRole::Video)
        .cloned()
        .collect();

    for file in &videos {
        let ovr = req.overrides.get(&file.path).cloned().unwrap_or_default();
        if ovr.exclude {
            continue;
        }
        let item = build_item(req, file, &ovr);
        // Correctly named AND healthy → nothing to do, drop from the plan.
        // Error items stay visible so the editor can fix them manually.
        if item.status != ItemStatus::Error && norm_key(&item.destination) == norm_key(&item.path) {
            continue;
        }
        items.push(item);
    }

    // ponytail: includeSubtitles=false only skips the rename pass; files
    // still ride along when organizing moves their host video later.
    if req.include_subtitles.unwrap_or(true) {
        plan_subtitles(req, &videos, &mut items);
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
                let stem = render_stem(MediaKind::Movie, &meta, req.templates.as_ref());
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
                let stem = render_stem(MediaKind::Tv, &meta, req.templates.as_ref());
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
        language: None,
        video_path: None,
        season: meta.season,
        episode: meta.episode,
        year: meta.year,
        status,
        warnings,
    }
}

/// Second pass: attach subtitle sidecars to their videos. A subtitle joins
/// the same-dir video sharing the most leading filename tokens ("Movie.fa"
/// ↔ "Movie.2026"); its new name is `<video stem>[.<lang>]<ext>` beside the
/// video's planned destination.
fn plan_subtitles(req: &PlanRequest, videos: &[ScannedFile], items: &mut Vec<PlanItem>) {
    use crate::scanner::FileRole;

    struct Host {
        stem: String, // new-name stem without extension
        directory: PathBuf,
        season: Option<u8>,
        episode: Option<u8>,
        year: Option<u16>,
    }
    // Owned table (no refs into `items`, which we mutate below).
    let hosts: HashMap<String, Host> = items
        .iter()
        .map(|it| {
            (
                norm_key(&it.path),
                Host {
                    stem: it
                        .new_name
                        .rsplit_once('.')
                        .map_or(it.new_name.clone(), |(s, _)| s.to_string()),
                    directory: it.directory.clone(),
                    season: it.season,
                    episode: it.episode,
                    year: it.year,
                },
            )
        })
        .collect();

    for file in &req.files {
        if file.role != FileRole::Subtitle {
            continue;
        }
        let ovr = req.overrides.get(&file.path).cloned().unwrap_or_default();
        if ovr.exclude {
            continue;
        }

        let Some(video) = find_host_video(file, videos) else {
            continue; // no matching video in this batch → leave alone
        };
        let Some(host) = hosts.get(&norm_key(&video.path)) else {
            continue;
        };

        let language = ovr
            .language
            .clone()
            .or_else(|| file.subtitle_language.clone());
        let ext = extension_of(&file.name);
        let new_name = match &language {
            Some(lang) => format!("{}.{}{}", host.stem, lang, ext),
            None => format!("{}{}", host.stem, ext),
        };
        let destination = host.directory.join(&new_name);

        // Already correctly named → nothing to do.
        if is_same_file(&destination, &file.path) {
            continue;
        }

        items.push(PlanItem {
            path: file.path.clone(),
            original_name: file.name.clone(),
            language,
            video_path: Some(video.path.clone()),
            new_name,
            directory: host.directory.clone(),
            destination,
            kind: MediaKind::Unknown, // sidecar row, not a video kind
            season: host.season,
            episode: host.episode,
            year: host.year,
            status: ItemStatus::Ready,
            warnings: Vec::new(),
        });
    }
}

/// Find the scanned video a subtitle belongs to: same parent dir, longest
/// run of equal LEADING separator-tokens wins ("Breaking.Bad.S01E01.fa" →
/// "Breaking.Bad.S01E01.1080p.mkv", 3 tokens).
fn find_host_video<'a>(sub: &ScannedFile, videos: &'a [ScannedFile]) -> Option<&'a ScannedFile> {
    let sub_dir = sub.path.parent()?;
    let sub_tokens: Vec<String> = stem_of(&sub.name)
        .split(['.', '_', ' ', '-'])
        .filter(|t| !t.is_empty())
        .map(str::to_string)
        .collect();
    let mut best: Option<(usize, &ScannedFile)> = None;
    for v in videos {
        if v.path.parent() != Some(sub_dir) {
            continue;
        }
        let v_stem = stem_of(&v.name);
        let v_tokens: Vec<&str> = v_stem
            .split(['.', '_', ' ', '-'])
            .filter(|t| !t.is_empty())
            .collect();
        let common = sub_tokens
            .iter()
            .zip(v_tokens.iter())
            .take_while(|(a, b)| a.eq_ignore_ascii_case(b))
            .count();
        if common > 0 && best.is_none_or(|(n, _)| common > n) {
            best = Some((common, v));
        }
    }
    best.map(|(_, v)| v)
}

fn stem_of(name: &str) -> String {
    name.rsplit_once('.')
        .map_or(name.to_string(), |(s, _)| s.to_string())
}

fn render_stem(kind: MediaKind, m: &EffectiveMeta, tpl: Option<&PlanTemplates>) -> String {
    let parsed = ParsedMedia {
        filename: String::new(),
        kind,
        title: m.title.clone(),
        year: m.year,
        season: m.season,
        episode: m.episode,
        episodes: m.episodes.clone(),
        resolution: m.resolution.clone(),
        codec: m.codec.clone(),
        audio: m.audio.clone(),
        language: None,
        group: m.group.clone(),
        edition: m.edition.clone(),
        low_confidence: false,
    };
    let default = PlanTemplates::default();
    let t = match kind {
        MediaKind::Movie => tpl.map_or(default.movie.as_str(), |t| {
            if t.movie.trim().is_empty() {
                default.movie.as_str()
            } else {
                t.movie.as_str()
            }
        }),
        _ => tpl.map_or(default.tv.as_str(), |t| {
            if t.tv.trim().is_empty() {
                default.tv.as_str()
            } else {
                t.tv.as_str()
            }
        }),
    };
    let mut stem = render_template(t, &parsed);
    // Multi-episode: "Show Name S01 E01" + episodes [1, 2, 3] → "... E01-E02-E03".
    if kind == MediaKind::Tv {
        if let Some(last) = m.episodes.as_ref().and_then(|e| e.last()) {
            if Some(*last) != parsed.episode {
                stem = format!("{stem}-E{last:0>2}");
            }
        }
    }
    stem
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
    let dest = req.destinations.as_ref();
    let movie_root = dest
        .filter(|d| !d.movie.as_os_str().is_empty())
        .map(|d| d.movie.clone())
        .unwrap_or_else(|| req.root.join("Movies"));
    let tv_root = dest
        .filter(|d| !d.tv.as_os_str().is_empty())
        .map(|d| d.tv.clone())
        .unwrap_or_else(|| req.root.join("TV Shows"));
    match kind {
        MediaKind::Movie => movie_root.join(sanitize_filename(title)),
        MediaKind::Tv => tv_root.join(sanitize_filename(title)).join(
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
