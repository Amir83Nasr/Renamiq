//! Subkade.ir integration: search Persian subtitles via the site's WordPress
//! REST API, pull the direct .zip link from the post page HTML, download,
//! and extract next to the target video.
use crate::core::error::{AppResult, RenamiqError};
use serde::Serialize;

const SITE: &str = "https://subkade.ir";
/// Direct-download host; post pages link here for free (Persian) subs.
const DL_HOST: &str = "dl1.subkade.ir";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubkadeResult {
    pub post_id: u32,
    pub title: String,
    pub url: String,
    /// Poster thumbnail from the search card; empty when the card has none.
    pub image: String,
}

/// dl hosts reject non-browser agents with 403, so pretend to be Chrome.
const BROWSER_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
    AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

fn http() -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .user_agent(BROWSER_UA)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| RenamiqError::with_source("Network is unavailable", e))
}

/// GET on the dl host requires a same-site Referer or it answers 403.
fn dl_request(client: &reqwest::blocking::Client, url: &str) -> reqwest::blocking::RequestBuilder {
    client
        .get(url)
        .header(reqwest::header::REFERER, format!("{SITE}/"))
}

/// Search the site's HTML endpoint (`/?s=query`) — the WP REST API rejects
/// anonymous requests (401). Result cards are `<a class="sk-query" href=…>`
/// wrapping an `<h3 dir="ltr">Title</h3>`; we pull pairs of (url, title).
pub fn search(query: &str, limit: u8) -> AppResult<Vec<SubkadeResult>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let url = format!("{SITE}/?s={}", utf8_percent_encode(query));
    let html = http()?
        .get(&url)
        .send()
        .map_err(|e| RenamiqError::with_source("Search failed", e))?
        .error_for_status()
        .map_err(|e| RenamiqError::with_source("Search failed", e))?
        .text()
        .map_err(|e| RenamiqError::with_source("Bad search response", e))?;

    let mut out = Vec::new();
    let mut rest = html.as_str();
    while out.len() < limit.clamp(1, 20).into() {
        // Next result card anchor.
        let Some(anchor_start) = rest.find("class=\"sk-query\"") else {
            break;
        };
        // href sits before the class attribute inside the same <a …>.
        let tag_start = rest[..anchor_start].rfind("<a ").unwrap_or(anchor_start);
        let href = rest[tag_start..anchor_start]
            .split("href=\"")
            .nth(1)
            .and_then(|h| h.find('"').map(|end| &h[..end]));
        // Card body runs to the matching </a>; poster <img> and title <h3>
        // both live inside it.
        let h3_from = anchor_start;
        let card_body = match rest[h3_from..].find("</a>") {
            Some(end) => &rest[h3_from..h3_from + end],
            None => break,
        };
        let title = card_body
            .split("<h3")
            .nth(1)
            .and_then(|h| h.split_once('>').map(|(_, body)| body))
            .and_then(|body| {
                body.find("</h3>")
                    .map(|end| strip_tags(&body[..end]).trim().to_string())
            });
        let image = card_body
            .split("<img")
            .nth(1)
            .and_then(|tag| tag.split("src=\"").nth(1))
            .and_then(|s| s.find('"').map(|end| s[..end].to_string()))
            .unwrap_or_default();
        match (href, title) {
            (Some(url), Some(title)) if !url.is_empty() && !title.is_empty() => {
                let post_id = url
                    .trim_end_matches('/')
                    .rsplit('-')
                    .next()
                    .and_then(|n| n.parse::<u32>().ok())
                    .unwrap_or(0);
                out.push(SubkadeResult {
                    post_id,
                    title,
                    url: url.trim().to_string(),
                    image,
                });
                // Continue after this card's </a>.
                rest = &rest[h3_from..];
                match rest.find("</a>") {
                    Some(i) => rest = &rest[i + 4..],
                    None => break,
                }
            }
            _ => break,
        }
    }
    Ok(out)
}

/// Fetch a post page and scrape its direct subtitle zip URL.
pub fn find_zip_link(post_url: &str) -> AppResult<String> {
    if !post_url.starts_with(SITE) {
        return Err(RenamiqError::user("Only subkade.ir links are supported"));
    }
    let html = http()?
        .get(post_url)
        .send()
        .map_err(|e| RenamiqError::with_source("Could not open that page", e))?
        .error_for_status()
        .map_err(|e| RenamiqError::with_source("Could not open that page", e))?
        .text()
        .map_err(|e| RenamiqError::with_source("Bad page response", e))?;

    // Free (Persian) subs are plain hrefs on dl1/dl2 hosts ending in .zip.
    for candidate in html.split("href=\"").skip(1) {
        let end = match candidate.find('"') {
            Some(i) => i,
            None => continue,
        };
        let link = &candidate[..end];
        if link.contains(DL_HOST) && link.to_lowercase().ends_with(".zip") {
            return Ok(link.trim().to_string());
        }
    }
    Err(RenamiqError::user(
        "Direct download link not found on this page",
    ))
}

/// Content-Length of the zip in bytes, for showing a size hint.
pub fn zip_size(zip_url: &str) -> AppResult<u64> {
    let len = dl_request(&http()?, zip_url)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .map_err(|e| RenamiqError::with_source("Could not reach file", e))?
        .error_for_status()
        .map_err(|e| RenamiqError::with_source("Could not reach file", e))?
        .content_length()
        .ok_or_else(|| RenamiqError::user("File size is unknown"))?;
    Ok(len)
}

/// Download the zip and extract subtitle files next to `video_path`.
/// Returns extracted file paths. `on_progress(bytes_downloaded)` is called as
/// bytes stream in; useful for emitting Tauri progress events.
pub fn download_and_extract(
    zip_url: &str,
    video_path: &std::path::Path,
    on_progress: impl FnMut(u64),
) -> AppResult<Vec<std::path::PathBuf>> {
    let dest_dir = video_path
        .parent()
        .ok_or_else(|| RenamiqError::user("Video has no parent folder"))?;
    download_to_dir(zip_url, dest_dir, "", on_progress)
}

/// Download the zip and extract subtitle files into `dest_dir` directly.
/// If `subfolder` is non-empty, creates `dest_dir/subfolder` and extracts into it.
pub fn download_to_dir(
    zip_url: &str,
    dest_dir: &std::path::Path,
    subfolder: &str,
    mut on_progress: impl FnMut(u64),
) -> AppResult<Vec<std::path::PathBuf>> {
    if !zip_url.starts_with("https://") || !zip_url.contains(DL_HOST) {
        return Err(RenamiqError::user("Unexpected download host"));
    }

    let mut response = dl_request(&http()?, zip_url)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .map_err(|e| RenamiqError::with_source("Download failed", e))?
        .error_for_status()
        .map_err(|e| RenamiqError::with_source("Download failed", e))?;

    // Stream the zip to a sibling temp file so we can rewind for the archive
    // reader. The temp file is removed whether extraction succeeds or fails.
    let temp = std::env::temp_dir().join(format!("renamiq-subkade-{}.zip", std::process::id()));
    let mut file = std::fs::File::create(&temp)
        .map_err(|e| RenamiqError::with_source("Could not write subtitle", e))?;
    let mut downloaded: u64 = 0;
    let mut buf = [0u8; 64 * 1024];
    let result: AppResult<()> = (|| {
        loop {
            let n = std::io::Read::read(&mut response, &mut buf)
                .map_err(|e| RenamiqError::with_source("Download failed", e))?;
            if n == 0 {
                break;
            }
            std::io::Write::write_all(&mut file, &buf[..n])
                .map_err(|e| RenamiqError::with_source("Download failed", e))?;
            downloaded = downloaded.saturating_add(n as u64);
            on_progress(downloaded);
        }
        Ok(())
    })();
    // Always flush the temp file before the reader re-opens it.
    drop(file);
    if let Err(e) = result {
        let _ = std::fs::remove_file(&temp);
        return Err(e);
    }

    let extract_result = extract_zip_entries(&temp, dest_dir, subfolder);
    let _ = std::fs::remove_file(&temp);
    extract_result
}

fn extract_zip_entries(
    zip_path: &std::path::Path,
    dest_dir: &std::path::Path,
    subfolder: &str,
) -> AppResult<Vec<std::path::PathBuf>> {
    let target_dir = if subfolder.is_empty() {
        dest_dir.to_path_buf()
    } else {
        let safe_sub: String = subfolder
            .chars()
            .map(|c| if std::path::is_separator(c) { ' ' } else { c })
            .collect();
        let d = dest_dir.join(safe_sub.trim());
        std::fs::create_dir_all(&d)
            .map_err(|e| RenamiqError::with_source("Could not create folder", e))?;
        d
    };

    let file = std::fs::File::open(zip_path)
        .map_err(|e| RenamiqError::with_source("Archive is corrupted", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| RenamiqError::with_source("Archive is corrupted", e))?;
    let mut out = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| RenamiqError::with_source("Archive is corrupted", e))?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };
        let target = target_dir.join(enclosed);
        if entry.is_dir() {
            std::fs::create_dir_all(&target)
                .map_err(|e| RenamiqError::with_source("Could not create folder", e))?;
            continue;
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| RenamiqError::with_source("Could not create folder", e))?;
        }
        if target.exists() {
            continue;
        }
        let mut out_file = std::fs::File::create(&target)
            .map_err(|e| RenamiqError::with_source("Could not write subtitle", e))?;
        std::io::copy(&mut entry, &mut out_file)
            .map_err(|e| RenamiqError::with_source("Could not write subtitle", e))?;
        out.push(target);
    }
    Ok(out)
}

#[allow(dead_code)]
fn is_subtitle_ext(name: &str) -> bool {
    let lower = name.to_lowercase();
    [".srt", ".ass", ".ssa", ".sub", ".vtt"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

fn strip_tags(html: &str) -> String {
    html.chars()
        .fold((String::new(), false), |(mut out, mut tag), c| {
            match c {
                '<' => tag = true,
                '>' => tag = false,
                _ if !tag => out.push(c),
                _ => {}
            }
            (out, tag)
        })
        .0
}

/// Minimal percent-encoding for WP REST query strings.
pub fn utf8_percent_encode_pub(s: &str) -> String {
    utf8_percent_encode(s)
}

fn utf8_percent_encode(s: &str) -> String {
    s.bytes()
        .map(
            |b| match b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
                true => (b as char).to_string(),
                false => format!("%{b:02X}"),
            },
        )
        .collect()
}
