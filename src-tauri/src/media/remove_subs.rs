//! Subtitle removal: strip embedded subtitle streams from a video via
//! the system ffmpeg. Writes to `<video>_nosub.<ext>` then swaps.

use std::path::{Path, PathBuf};
use std::process::Command;

use crate::core::error::{AppResult, RenamiqError};

pub fn remove_subtitles(video: &Path) -> AppResult<PathBuf> {
    if !video.is_file() {
        return Err(RenamiqError::user(format!(
            "File not found: {}",
            video.display()
        )));
    }
    let ext = video.extension().and_then(|e| e.to_str()).unwrap_or("mkv");
    let (container, _) = match ext.to_ascii_lowercase().as_str() {
        "mp4" | "m4v" | "mov" => ("mp4", "mov_text"),
        _ => ("matroska", "srt"),
    };
    let out = sibling_path(video, "_nosub", &["mkv", "mp4"]);

    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            video.to_string_lossy().as_ref(),
            "-map",
            "0",
            "-map",
            "-0:s",
            "-c",
            "copy",
            "-f",
            container,
        ])
        .arg(&out)
        .status()
        .map_err(|_| RenamiqError::user("ffmpeg not found — install it first"))?;

    if !status.success() {
        return Err(RenamiqError::user(
            "ffmpeg failed — video format may be unsupported",
        ));
    }

    fs_err_replace(&out, video)?;
    Ok(out)
}

fn sibling_path(video: &Path, suffix: &str, exts: &[&str]) -> PathBuf {
    let stem = video
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video");
    for ext in exts {
        let candidate = video.with_file_name(format!("{stem}{suffix}.{ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    video.with_file_name(format!("{stem}{suffix}-{}.{}", std::process::id(), exts[0]))
}

fn fs_err_replace(from: &Path, to: &Path) -> AppResult<()> {
    if std::fs::rename(from, to).is_ok() {
        return Ok(());
    }
    std::fs::copy(from, to)
        .map_err(|e| RenamiqError::with_source("Could not replace the video", e))?;
    std::fs::remove_file(from)
        .map_err(|e| RenamiqError::with_source("Could not clean up temp file", e))
}
