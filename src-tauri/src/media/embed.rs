//! Subtitle muxing: embed .srt/.ass files into a video as soft subs via
//! the system ffmpeg. Writes to `<video>_subbed.<ext>` then swaps, so the
//! original survives if ffmpeg fails.
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::core::error::{AppResult, RenamiqError};

pub struct EmbedRequest {
    pub video: PathBuf,
    pub subtitle: PathBuf,
    /// ISO 639 language tag stored in the track metadata (e.g. "per").
    pub language: String,
}

/// Returns the output path on success.
pub fn embed(req: &EmbedRequest) -> AppResult<PathBuf> {
    let video = &req.video;
    let subtitle = &req.subtitle;
    for p in [video, subtitle] {
        if !p.is_file() {
            return Err(RenamiqError::user(format!(
                "File not found: {}",
                p.display()
            )));
        }
    }
    let ext = video.extension().and_then(|e| e.to_str()).unwrap_or("mkv");
    // Matroska handles every subtitle codec; mp4 only accepts mov_text.
    let (container, sub_codec) = match ext.to_ascii_lowercase().as_str() {
        "mp4" | "m4v" | "mov" => ("mp4", "mov_text"),
        _ => ("matroska", "srt"),
    };
    let out = sibling_path(video, "_subbed", &["mkv", "mp4"]);

    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            video.to_string_lossy().as_ref(),
            "-i",
            subtitle.to_string_lossy().as_ref(),
            "-map",
            "0:v",
            "-map",
            "0:a?",
            // ponytail: pre-existing soft subs are dropped so the muxed
            // track is always output stream :0; keep 0:s? + :1 indexing
            // if preserving embedded subs ever matters.
            "-map",
            "1:0",
            "-c",
            "copy",
            "-c:s:0",
            sub_codec,
            "-metadata:s:s:0",
            &format!("language={}", req.language),
            "-metadata:s:s:0",
            "title=Persian",
            "-disposition:s:0",
            "default",
            "-f",
            container,
        ])
        .arg(&out)
        .status()
        .map_err(|_| RenamiqError::user("ffmpeg not found — install it first"))?;
    if !status.success() {
        return Err(RenamiqError::user(
            "ffmpeg failed — subtitle or video format may be unsupported",
        ));
    }

    fs_err_replace(&out, video)?;
    Ok(out)
}

/// `<dir>/<stem><suffix>.<first-available-ext>` that does not clobber
/// either input; falls back to a random tail when both are taken.
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

/// Move `from` over `to`, replacing it; cross-device safe via copy fallback.
fn fs_err_replace(from: &Path, to: &Path) -> AppResult<()> {
    if std::fs::rename(from, to).is_ok() {
        return Ok(());
    }
    std::fs::copy(from, to)
        .map_err(|e| RenamiqError::with_source("Could not replace the video", e))?;
    std::fs::remove_file(from)
        .map_err(|e| RenamiqError::with_source("Could not clean up temp file", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sibling_avoids_clobbers() {
        let dir = std::env::temp_dir().join(format!("embed-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let v = dir.join("Movie.mkv");
        assert_eq!(
            sibling_path(&v, "_subbed", &["mkv", "mp4"]),
            dir.join("Movie_subbed.mkv")
        );
        std::fs::write(dir.join("Movie_subbed.mkv"), b"x").unwrap();
        assert_eq!(
            sibling_path(&v, "_subbed", &["mkv", "mp4"]),
            dir.join("Movie_subbed.mp4")
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn embed_rejects_missing_video() {
        let err = embed(&EmbedRequest {
            video: "/nonexistent/video.mkv".into(),
            subtitle: "/nonexistent/sub.srt".into(),
            language: "per".into(),
        })
        .unwrap_err();
        assert!(err.to_string().contains("File not found"));
    }
}
