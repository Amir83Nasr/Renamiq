//! Integration test: scan → parse → plan → execute on a temp directory.
//! Never touches the real filesystem outside std::env::temp_dir.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

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

fn plan_req(root: &PathBuf, files: Vec<crate::scanner::ScannedFile>) -> PlanRequest {
    PlanRequest {
        root: root.clone(),
        files,
        organize: false,
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
    let plan = build_plan(&plan_req(&root.parent().unwrap().to_path_buf(), scan.files));
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
