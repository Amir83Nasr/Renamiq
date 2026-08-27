//! OMDb (omdbapi.com) integration: search movies/TV by name and download
//! the poster image. Uses the free OMDb API (api key "trilogy") or a user key.
use crate::core::error::{AppResult, RenamiqError};
use serde::{Deserialize, Serialize};

const API: &str = "https://www.omdbapi.com";
/// ponytail: free public OMDb key; lets poster search work with zero setup.
/// A user key from Settings wins.
const FALLBACK_KEY: &str = "trilogy";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbResult {
    pub id: u64,
    pub title: String,
    pub year: Option<u32>,
    /// True for TV shows, false for movies.
    pub is_tv: bool,
    /// Full poster URL (Amazon CDN) or empty when the result has no poster.
    pub poster_url: String,
}

fn http() -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Renamiq)")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| RenamiqError::with_source("Network is unavailable", e))
}

/// OMDDb edge can be flaky; retry once before giving up.
fn get_json(url: &str) -> AppResult<serde_json::Value> {
    let client = http()?;
    let mut last = RenamiqError::user("Search failed");
    for _ in 0..2 {
        match client
            .get(url)
            .send()
            .and_then(|r| r.error_for_status())
            .and_then(|r| r.json())
        {
            Ok(json) => return Ok(json),
            Err(e) => last = RenamiqError::with_source("Search failed", e),
        }
    }
    Err(last)
}

/// Search IMDb suggestion API for official, high-quality movie & TV posters.
pub fn search(query: &str, _api_key: &str, limit: u8) -> AppResult<Vec<TmdbResult>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let first_char = query.chars().next().unwrap_or('a').to_ascii_lowercase();
    let enc = crate::media::subkade::utf8_percent_encode_pub(query);
    let url = format!("https://v2.sg.media-imdb.com/suggestion/{}/{}.json", first_char, enc);

    let client = http()?;
    let resp = client.get(&url).send();
    let json: serde_json::Value = match resp {
        Ok(r) if r.status().is_success() => r.json().unwrap_or_default(),
        _ => {
            // Fallback to OMDb if IMDb suggestion fails
            return search_omdb(query, _api_key, limit);
        }
    };

    let Some(d) = json["d"].as_array() else {
        return search_omdb(query, _api_key, limit);
    };

    let mut out = Vec::new();
    for item in d {
        if out.len() >= limit as usize {
            break;
        }
        let q_type = item["q"].as_str().unwrap_or_default();
        if q_type != "feature" && q_type != "tvSeries" && q_type != "tvMiniSeries" {
            continue;
        }
        let title = item["l"].as_str().unwrap_or_default().to_string();
        if title.is_empty() {
            continue;
        }
        let year = item["y"].as_u64().map(|y| y as u32);
        let id_str = item["id"].as_str().unwrap_or_default();
        let id = id_str
            .trim_start_matches('t')
            .parse::<u64>()
            .unwrap_or_else(|_| id_str.bytes().fold(0, |acc, b| acc.wrapping_add(b as u64)));

        let is_tv = q_type.contains("tv");
        let poster_url = item["i"]["imageUrl"]
            .as_str()
            .unwrap_or_default()
            .to_string();

        out.push(TmdbResult {
            id,
            title,
            year,
            is_tv,
            poster_url,
        });
    }

    if out.is_empty() {
        return search_omdb(query, _api_key, limit);
    }

    Ok(out)
}

fn search_omdb(query: &str, api_key: &str, limit: u8) -> AppResult<Vec<TmdbResult>> {
    let api_key = match api_key.trim() {
        "" => FALLBACK_KEY,
        k => k,
    };
    let enc = crate::media::subkade::utf8_percent_encode_pub(query);
    let mut out: Vec<TmdbResult> = Vec::new();
    for media_type in ["movie", "series"] {
        if out.len() >= limit as usize {
            break;
        }
        let url = format!("{API}/?s={enc}&type={media_type}&apikey={api_key}");
        let Ok(json) = get_json(&url) else {
            continue;
        };
        if json["Response"].as_str() == Some("False") {
            continue;
        }
        let Some(items) = json["Search"].as_array() else {
            continue;
        };
        for item in items {
            if out.len() >= limit as usize {
                break;
            }
            let title = item["Title"].as_str().unwrap_or_default().to_string();
            if title.is_empty() {
                continue;
            }
            let year = item["Year"]
                .as_str()
                .and_then(|y| y.get(0..4))
                .and_then(|y| y.parse::<u32>().ok());
            let poster = item["Poster"].as_str().unwrap_or("").to_string();
            let id = item["imdbID"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            out.push(TmdbResult {
                id,
                title,
                year,
                is_tv: media_type == "series",
                poster_url: if poster == "N/A" {
                    String::new()
                } else {
                    poster
                },
            });
        }
    }
    Ok(out)
}

/// Download the poster image from the full URL and save it as
/// `<dest_dir>/<title>.jpg`. Streams the body and reports
/// `on_progress(downloaded, total)` so the UI can show a live progress bar.
pub fn download_poster(
    result: &TmdbResult,
    _api_key: &str,
    dest_dir: &std::path::Path,
    mut on_progress: impl FnMut(u64, u64),
) -> AppResult<std::path::PathBuf> {
    use std::io::{Read, Write};
    if result.poster_url.is_empty() {
        return Err(RenamiqError::user("This result has no poster"));
    }

    let client = http()?;
    let mut response = (0..2)
        .find_map(|_| {
            client
                .get(&result.poster_url)
                .timeout(std::time::Duration::from_secs(60))
                .send()
                .and_then(|r| r.error_for_status())
                .ok()
        })
        .ok_or_else(|| RenamiqError::user("Download failed"))?;

    std::fs::create_dir_all(dest_dir)
        .map_err(|e| RenamiqError::with_source("Could not create folder", e))?;
    let safe_title: String = result
        .title
        .chars()
        .map(|c| if std::path::is_separator(c) { ' ' } else { c })
        .collect();
    let file = dest_dir.join(format!("{safe_title}.jpg"));
    let mut out = std::fs::File::create(&file)
        .map_err(|e| RenamiqError::with_source("Could not write poster", e))?;
    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut buf = [0u8; 32 * 1024];
    loop {
        let n = response
            .read(&mut buf)
            .map_err(|e| RenamiqError::with_source("Download failed", e))?;
        if n == 0 {
            break;
        }
        out.write_all(&buf[..n])
            .map_err(|e| RenamiqError::with_source("Download failed", e))?;
        downloaded = downloaded.saturating_add(n as u64);
        on_progress(downloaded, total);
    }
    Ok(file)
}
