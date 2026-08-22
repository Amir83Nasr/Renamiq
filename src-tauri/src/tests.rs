//! Integration test: scan → parse → plan on a temp directory.
//! Never touches the real filesystem outside std::env::temp_dir.

use std::fs;
use std::path::PathBuf;

use crate::rename::planner::build_plan;
use crate::scanner::{scan_directory, FileRole};

fn temp_tree(label: &str) -> PathBuf {
    use std::sync::atomic::{AtomicU32, Ordering};
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let dir = std::env::temp_dir().join(format!(
        "renamiq-test-{}-{label}-{n}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn scan_parse_plan_end_to_end() {
    let root = temp_tree("e2e");
    fs::write(root.join("Breaking.Bad.S01E01.1080p.WEB-DL.x265-GROUP.mkv"), b"v").unwrap();
    fs::write(root.join("Breaking.Bad.S01E01.fa.srt"), b"s").unwrap();
    fs::write(root.join("Breaking.Bad.S01E02.1080p.WEB-DL.x265-GROUP.mkv"), b"v").unwrap();
    fs::write(root.join("Obsession.2026.1080p.WEB-DL.x265-GROUP.mkv"), b"v").unwrap();
    fs::write(root.join("notes.txt"), b"ignored").unwrap();

    let scan = scan_directory(&root).unwrap();
    assert_eq!(scan.files.len(), 4, "only media + subtitles scanned");

    let videos = scan
        .files
        .iter()
        .filter(|f| f.role == FileRole::Video)
        .count();
    assert_eq!(videos, 3);

    let plan = build_plan(&root, &scan.files, true);
    // 3 videos + 1 subtitle = 4 ops; notes.txt not in scan.
    assert_eq!(plan.ops.len(), 4);
    assert!(plan.skipped.is_empty());

    // TV episode lands in TV Shows/<show>/Season NN/.
    let ep1 = plan
        .ops
        .iter()
        .find(|op| {
            op.source.to_string_lossy().contains("S01E01") && !op.source.to_string_lossy().contains("srt")
        })
        .unwrap();
    let dest = ep1.destination.to_string_lossy();
    assert!(dest.contains("TV Shows"), "{dest}");
    assert!(dest.contains("Season 01"), "{dest}");
    assert!(dest.ends_with("Breaking Bad S01 E01.mkv"), "{dest}");

    // Movie lands in Movies/<title>/.
    let movie = plan
        .ops
        .iter()
        .find(|op| op.source.to_string_lossy().contains("Obsession"))
        .unwrap();
    assert!(
        movie
            .destination
            .to_string_lossy()
            .ends_with("Movies/Obsession/Obsession 2026.mkv"),
        "{}",
        movie.destination.display()
    );

    // Subtitle follows its episode into the season folder with language tag.
    use std::ffi::OsStr;
    let sub = plan
        .ops
        .iter()
        .find(|op| op.source.extension() == Some(OsStr::new("srt")))
        .unwrap();
    let sub_dest = sub.destination.to_string_lossy();
    assert!(sub_dest.ends_with("Breaking Bad S01 E01.fa.srt"), "{sub_dest}");
    assert!(sub_dest.contains("Season 01"), "{sub_dest}");

    fs::remove_dir_all(&root).ok();
}

#[test]
fn execute_and_undo_roundtrip() {
    let root = temp_tree("undo");
    fs::create_dir_all(&root).unwrap();
    fs::write(root.join("Movie.2019.1080p.mkv"), b"x").unwrap();

    let scan = scan_directory(&root).unwrap();
    let plan = build_plan(&root, &scan.files, false); // flat rename
    assert_eq!(plan.ops.len(), 1);

    let results = crate::rename::executor::execute_plan(&plan.ops, &[]).unwrap();
    assert!(results.iter().all(|r| r.ok));
    assert!(root.join("Movie 2019.mkv").exists());
    assert!(!root.join("Movie.2019.1080p.mkv").exists());

    // Manual undo (executor-level; DB undo tested via command layer).
    let op = &plan.ops[0];
    std::fs::rename(&op.destination, &op.source).unwrap();
    assert!(root.join("Movie.2019.1080p.mkv").exists());

    fs::remove_dir_all(&root).ok();
}

#[test]
fn collision_flagged_not_executed() {
    let root = temp_tree("collide");
    fs::write(root.join("Movie.2019.1080p.mkv"), b"x").unwrap();
    fs::write(root.join("Movie 2019.mkv"), b"existing").unwrap();

    let scan = scan_directory(&root).unwrap();
    let plan = build_plan(&root, &scan.files, false);
    let op = plan.ops.iter().find(|o| o.id == "op-1").unwrap();
    assert!(op.collides_on_disk, "pre-existing dest must flag collision");

    // Execution without overwrite must NOT touch the existing file.
    let results = crate::rename::executor::execute_plan(&plan.ops, &[]).unwrap();
    assert!(!results[0].ok);
    assert_eq!(fs::read(root.join("Movie 2019.mkv")).unwrap(), b"existing");

    fs::remove_dir_all(&root).ok();
}
