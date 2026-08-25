//! Integration test: scan → parse → plan → execute on a temp directory.
//! Never touches the real filesystem outside std::env::temp_dir.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::rename::executor;
use crate::rename::planner::{build_plan, ConflictResolution, FileOverride, PlanRequest};
use crate::scanner::{scan_directory, scan_paths};

fn temp_tree(label: &str) -> PathBuf {
    use std::sync::atomic::{AtomicU32, Ordering};
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!("renamiq-test-{}-{label}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn plan_req(root: &std::path::Path, files: Vec<crate::scanner::ScannedFile>) -> PlanRequest {
    PlanRequest {
        root: root.to_path_buf(),
        files,
        organize: false,
        templates: None,
        include_subtitles: None,
        overrides: HashMap::new(),
        resolutions: HashMap::new(),
    }
}

#[test]
fn scan_parse_plan_end_to_end() {
    let root = temp_tree("e2e");
    fs::write(
        root.join("Breaking.Bad.S01E01.1080p.WEB-DL.x265-GROUP.mkv"),
        b"v",
    )
    .unwrap();
    fs::write(root.join("notes.txt"), b"ignored").unwrap();

    let scan = scan_directory(&root).unwrap();
    assert_eq!(scan.files.len(), 1, "only media scanned");

    let plan = build_plan(&plan_req(&root, scan.files));
    assert_eq!(plan.items.len(), 1);
    assert_eq!(plan.ready_count, 1);

    let it = &plan.items[0];
    assert_eq!(it.status, crate::rename::planner::ItemStatus::Ready);
    assert_eq!(it.new_name, "Breaking Bad S01 E01.mkv");
    assert_eq!(it.directory, root, "flat mode renames in place");

    fs::remove_dir_all(&root).ok();
}

#[test]
fn organize_builds_tv_folders() {
    let root = temp_tree("org");
    fs::write(root.join("Show.Name.S02E03.2160p.WEB-DL.mkv"), b"v").unwrap();
    let scan = scan_directory(&root).unwrap();

    let mut r = plan_req(&root, scan.files);
    r.organize = true;
    let plan = build_plan(&r);

    assert!(
        plan.items[0]
            .destination
            .to_string_lossy()
            .ends_with("TV Shows/Show Name/Season 02/Show Name S02 E03.mkv"),
        "{}",
        plan.items[0].destination.display()
    );
    fs::remove_dir_all(&root).ok();
}

#[test]
fn execute_and_undo_roundtrip() {
    let root = temp_tree("undo");
    fs::write(root.join("Movie.2019.1080p.mkv"), b"x").unwrap();

    let scan = scan_directory(&root).unwrap();
    let plan = build_plan(&plan_req(&root, scan.files));
    assert_eq!(plan.ready_count, 1);

    let results = executor::execute_plan(&plan.items.clone(), &HashMap::new()).unwrap();
    assert!(results.iter().all(|r| r.ok));
    assert!(root.join("Movie 2019.mkv").exists());

    // Undo via journal (same path the command layer uses).
    let journal = vec![executor::JournalEntry {
        from: plan.items[0].path.clone(),
        to: results[0].destination.clone().unwrap(),
    }];
    assert_eq!(executor::undo_journal(&journal).unwrap(), 1);
    assert!(root.join("Movie.2019.1080p.mkv").exists());

    fs::remove_dir_all(&root).ok();
}

#[test]
fn collision_conflict_then_suffix_resolution() {
    let root = temp_tree("collide");
    fs::write(root.join("Movie.2019.1080p.mkv"), b"x").unwrap();
    fs::write(root.join("Movie 2019.mkv"), b"existing").unwrap();

    let scan = scan_directory(&root).unwrap();
    let mut r = plan_req(&root, scan.files.clone());
    let plan = build_plan(&r);
    assert_eq!(
        plan.items[0].status,
        crate::rename::planner::ItemStatus::Conflict,
        "pre-existing dest must flag conflict"
    );
    // Execution refuses conflicts.
    let results = executor::execute_plan(&plan.items.clone(), &HashMap::new()).unwrap();
    assert_eq!(results.len(), 0);
    assert_eq!(fs::read(root.join("Movie 2019.mkv")).unwrap(), b"existing");

    // User picks "suffix" → Movie 2019 (2).mkv.
    let messy = scan
        .files
        .iter()
        .find(|f| f.name == "Movie.2019.1080p.mkv")
        .unwrap();
    r.resolutions
        .insert(messy.path.clone(), ConflictResolution::Suffix);
    let plan2 = build_plan(&r);
    let it2 = plan2
        .items
        .iter()
        .find(|it| it.original_name == "Movie.2019.1080p.mkv")
        .unwrap();
    assert_eq!(it2.status, crate::rename::planner::ItemStatus::Ready);
    assert_eq!(it2.new_name, "Movie 2019 (2).mkv");

    fs::remove_dir_all(&root).ok();
}

#[test]
fn loose_files_scan_in_place() {
    let root = temp_tree("loose");
    fs::create_dir_all(&root).unwrap();
    let f1 = root.join("A.2020.mkv");
    let f2 = root.join("B.2021.mp4");
    fs::write(&f1, b"a").unwrap();
    fs::write(&f2, b"b").unwrap();

    let scan = scan_paths(&[f1, f2]).unwrap();
    assert_eq!(scan.files.len(), 2);
    let plan = build_plan(&plan_req(root.parent().unwrap(), scan.files));
    // Flat rename keeps files next to themselves.
    for it in &plan.items {
        assert_eq!(it.directory, root);
    }
    fs::remove_dir_all(&root).ok();
}

#[test]
fn override_excludes_and_customizes() {
    let root = temp_tree("ovr");
    fs::write(root.join("Keep.2020.mkv"), b"k").unwrap();
    fs::write(root.join("Messy.S01E01.mkv"), b"m").unwrap();

    let scan = scan_directory(&root).unwrap();
    let mut r = plan_req(&root, scan.files.clone());
    r.overrides.insert(
        scan.files
            .iter()
            .find(|f| f.name.contains("Messy"))
            .unwrap()
            .path
            .clone(),
        FileOverride {
            custom_name: Some("Custom Episode".into()),
            ..Default::default()
        },
    );
    let plan = build_plan(&r);
    let messy = plan
        .items
        .iter()
        .find(|it| it.original_name.contains("Messy"))
        .unwrap();
    assert_eq!(messy.new_name, "Custom Episode.mkv");
    assert_eq!(messy.status, crate::rename::planner::ItemStatus::Ready);
    fs::remove_dir_all(&root).ok();
}

// ── UNIT TESTS (moved from planner.rs) ───────────────────────

use crate::parser::MediaKind;
use crate::rename::planner::ItemStatus;
use crate::scanner::{FileRole, ScannedFile};

fn scanned(name: &str, role: FileRole, subtitle_language: Option<&str>) -> ScannedFile {
    ScannedFile {
        path: PathBuf::from("/lib").join(name),
        name: name.into(),
        extension: PathBuf::from(name)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default(),
        size_bytes: 0,
        role,
        parsed: if role == FileRole::Video {
            Some(crate::parser::parse_filename(name))
        } else {
            None
        },
        subtitle_language: subtitle_language.map(str::to_string),
    }
}

fn video(name: &str) -> ScannedFile {
    scanned(name, FileRole::Video, None)
}

fn subtitle(name: &str) -> ScannedFile {
    scanned(name, FileRole::Subtitle, Some("fa"))
}

fn unit_req(files: Vec<ScannedFile>) -> PlanRequest {
    PlanRequest {
        root: PathBuf::from("/lib"),
        files,
        organize: false,
        templates: None,
        include_subtitles: None,
        overrides: HashMap::new(),
        resolutions: HashMap::new(),
    }
}

#[test]
fn movie_ready_flat_rename_in_place() {
    let plan = build_plan(&unit_req(vec![video(
        "Obsession.2026.1080p.x265-GROUP.mkv",
    )]));
    assert_eq!(plan.items.len(), 1);
    let it = &plan.items[0];
    assert_eq!(it.status, ItemStatus::Ready);
    assert_eq!(it.new_name, "Obsession 2026.mkv");
    assert_eq!(it.directory, PathBuf::from("/lib"));
}

#[test]
fn year_only_file_is_ready_movie() {
    let plan = build_plan(&unit_req(vec![video("Show.Name.2020.720p.mkv")]));
    let it = &plan.items[0];
    assert_eq!(it.status, ItemStatus::Ready);
    assert_eq!(it.new_name, "Show Name 2020.mkv");
}

#[test]
fn garbage_is_error_and_cannot_execute() {
    // Error items keep their destination at the source, so the batch
    // executor refuses them — and they never enter the plan as no-ops.
    let plan = build_plan(&unit_req(vec![video("x264_final_render.mkv")]));
    assert!(plan.items.is_empty() || plan.items.iter().all(|it| it.status == ItemStatus::Error));
}

#[test]
fn custom_name_overrides_everything() {
    let mut r = unit_req(vec![video("Messy.Name.S01E05.mkv")]);
    r.overrides.insert(
        r.files[0].path.clone(),
        FileOverride {
            custom_name: Some("My Episode".into()),
            ..Default::default()
        },
    );
    let plan = build_plan(&r);
    assert_eq!(plan.items[0].new_name, "My Episode.mkv");
    assert_eq!(plan.items[0].status, ItemStatus::Ready);
}

#[test]
fn override_fixes_missing_episode() {
    let mut r = unit_req(vec![video("Show.Name.S01E05.1080p.mkv")]);
    r.organize = true;
    r.overrides.insert(
        r.files[0].path.clone(),
        FileOverride {
            season: Some(3),
            ..Default::default()
        },
    );
    let plan = build_plan(&r);
    let it = &plan.items[0];
    assert_eq!(it.status, ItemStatus::Ready);
    assert!(
        it.destination
            .to_string_lossy()
            .ends_with("TV Shows/Show Name/Season 03/Show Name S03 E05.mkv"),
        "{}",
        it.destination.display()
    );
}

#[test]
fn excluded_files_skipped() {
    let mut r = unit_req(vec![video("A.2020.mkv"), video("B.2021.mkv")]);
    r.overrides.insert(
        r.files[0].path.clone(),
        FileOverride {
            exclude: true,
            ..Default::default()
        },
    );
    let plan = build_plan(&r);
    assert_eq!(plan.items.len(), 1);
}

#[test]
fn same_destination_twice_flags_conflict() {
    let mk = |n: &str| FileOverride {
        custom_name: Some(n.into()),
        ..Default::default()
    };
    let mut r = unit_req(vec![
        video("Movie.2019.CD1.mkv"),
        video("Movie.2019.CD2.mkv"),
    ]);
    r.overrides
        .insert(r.files[1].path.clone(), mk("Movie 2019"));
    r.overrides
        .insert(r.files[0].path.clone(), mk("Movie 2019"));
    let plan = build_plan(&r);
    assert!(plan
        .items
        .iter()
        .any(|it| it.warnings.iter().any(|w| w == "duplicate")));
    assert_eq!(plan.ready_count, 0);
}

// ── IPC SERDE KEY INTEGRITY ──────────────────────────────────

/// Frontend sends overrides/resolutions as Record<string, …>; Tauri
/// deserializes into HashMap<PathBuf, …>. Keys must survive the roundtrip
/// and still match item.path exactly — a single lost character silently
/// drops every override.
#[test]
fn plan_request_json_keys_match_item_paths() {
    let files = [
        video("Movie A.2020.mkv"),
        video("Show S01E01.mkv"),
        video("Persian نام.2021.mkv"),
    ];

    // Build the exact JSON the frontend sends: camelCase fields,
    // path-string keys on overrides/resolutions.
    let overrides: serde_json::Map<String, serde_json::Value> = files
        .iter()
        .map(|f| {
            (
                f.path.to_string_lossy().into_owned(),
                serde_json::json!({ "title": "T" }),
            )
        })
        .collect();
    let resolutions: serde_json::Map<String, serde_json::Value> = files
        .iter()
        .map(|f| {
            (
                f.path.to_string_lossy().into_owned(),
                serde_json::json!("suffix"),
            )
        })
        .collect();

    let json = serde_json::json!({
        "root": "/lib",
        "files": files.iter()
            .map(|f| serde_json::to_value(f).unwrap())
            .collect::<Vec<_>>(),
        "organize": false,
        "overrides": overrides,
        "resolutions": resolutions,
    })
    .to_string();

    // Deserialize through the same type Tauri's command layer uses.
    let back: PlanRequest = serde_json::from_str(&json).unwrap();

    let plan = build_plan(&back);
    assert_eq!(plan.items.len(), 3, "no override dropped by key mismatch");
    for it in &plan.items {
        assert!(
            back.overrides.contains_key(&it.path),
            "override key missing for {}",
            it.path.display()
        );
        assert!(
            back.resolutions.contains_key(&it.path),
            "resolution key missing for {}",
            it.path.display()
        );
    }
    // Every item actually consumed its override (title applied first).
    for it in &plan.items {
        if it.status == ItemStatus::Ready || it.status == ItemStatus::NeedsReview {
            let stem = it
                .new_name
                .rsplit_once('.')
                .unwrap_or((it.new_name.as_str(), ""))
                .0;
            assert!(stem.starts_with("T"), "{}", it.new_name);
        }
    }
}

// ── SUBTITLE SIDECARS ────────────────────────────────────────

#[test]
fn subtitle_follows_video_rename() {
    // Video renamed flat, subtitle tagged fa → "Movie 2026.fa.srt".
    let files = vec![
        video("Movie.2026.1080p.x265-GROUP.mkv"),
        subtitle("Movie.2026.1080p.x265-GROUP.fa.srt"),
    ];
    let plan = build_plan(&unit_req(files));
    assert_eq!(plan.items.len(), 2);

    let sub = plan
        .items
        .iter()
        .find(|it| it.language.is_some())
        .expect("subtitle planned");
    assert_eq!(sub.new_name, "Movie 2026.fa.srt");
    assert_eq!(sub.status, ItemStatus::Ready);
    assert_eq!(
        sub.video_path.as_deref(),
        Some(Path::new("/lib/Movie.2026.1080p.x265-GROUP.mkv"))
    );
}

#[test]
fn subtitle_matches_tv_episode_tokens() {
    let files = vec![
        video("Show.Name.S01E05.1080p.WEB-DL.mkv"),
        // Scanner extracts "en" from the name at scan time.
        scanned("Show.Name.S01E05.en.srt", FileRole::Subtitle, Some("en")),
    ];
    let plan = build_plan(&unit_req(files));
    let sub = plan
        .items
        .iter()
        .find(|it| it.kind == MediaKind::Unknown)
        .unwrap();
    assert_eq!(sub.new_name, "Show Name S01 E05.en.srt");
    // Language came from the filename even without a scanned tag.
    assert_eq!(sub.language.as_deref(), Some("en"));
}

#[test]
fn subtitle_organize_lands_in_season_folder() {
    let mut r = unit_req(vec![
        video("Show.S02E03.2160p.WEB-DL.mkv"),
        subtitle("Show.S02E03.2160p.WEB-DL.fa.srt"),
    ]);
    r.organize = true;
    let plan = build_plan(&r);
    let sub = plan.items.iter().find(|it| it.language.is_some()).unwrap();
    assert!(
        sub.destination
            .to_string_lossy()
            .ends_with("TV Shows/Show/Season 02/Show S02 E03.fa.srt"),
        "{}",
        sub.destination.display()
    );
}

#[test]
fn orphan_subtitle_left_alone() {
    let plan = build_plan(&unit_req(vec![subtitle("Random.File.fa.srt")]));
    assert_eq!(plan.items.len(), 0, "no host video in batch");
}

#[test]
fn excluded_video_leaves_subtitle_unhosted() {
    let mut r = unit_req(vec![
        video("Movie.2020.mkv"),
        subtitle("Movie.2020.mkv.fa.srt"),
    ]);
    r.overrides.insert(
        PathBuf::from("/lib/Movie.2020.mkv"),
        FileOverride {
            exclude: true,
            ..Default::default()
        },
    );
    let plan = build_plan(&r);
    assert_eq!(plan.items.len(), 0);
}

#[test]
fn execute_renames_pair_and_undo_restores() {
    let root = temp_tree("subexec");
    fs::write(root.join("Movie.2026.1080p-GROUP.mkv"), b"v").unwrap();
    fs::write(root.join("Movie.2026.1080p-GROUP.fa.srt"), b"s").unwrap();

    let scan = scan_directory(&root).unwrap();
    let plan = build_plan(&plan_req(&root, scan.files));
    assert_eq!(plan.items.len(), 2, "video + sidecar");

    let results = executor::execute_plan(&plan.items.clone(), &HashMap::new()).unwrap();
    assert!(results.iter().all(|r| r.ok));
    assert!(root.join("Movie 2026.mkv").exists());
    assert!(root.join("Movie 2026.fa.srt").exists());

    // Journal reverses both, newest (subtitle) first.
    let journal: Vec<executor::JournalEntry> = results
        .iter()
        .filter_map(|r| {
            r.destination.clone().map(|to| executor::JournalEntry {
                from: r.path.clone(),
                to,
            })
        })
        .collect();
    assert_eq!(executor::undo_journal(&journal).unwrap(), 2);
    assert!(root.join("Movie.2026.1080p-GROUP.fa.srt").exists());

    fs::remove_dir_all(&root).ok();
}
