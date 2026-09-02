//! OMDb (omdbapi.com) and IMDb suggestion integration: search movies/TV by name
//! and download the poster image. Uses the free OMDb API or IMDb suggestion API.
use crate::core::error::{AppResult, RenamiqError};
use serde::{Deserialize, Serialize};

const API: &str = "https://www.omdbapi.com";
const FALLBACK_KEY: &str = "trilogy";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbResult {
    pub id: u64,
    pub title: String,
    pub year: Option<u32>,
    /// True for TV shows, false for movies.
    pub is_tv: bool,
    /// Full poster URL or empty when the result has no poster.
    pub poster_url: String,
    /// IMDb rank or sort weight for ranking results.
    pub rank: u32,
}

fn http() -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| RenamiqError::with_source("Network is unavailable", e))
}

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

/// Search IMDb suggestion API and fall back to OMDb.
/// Collects more results and sorts them by IMDb rank/popularity.
pub fn search(query: &str, api_key: &str, limit: u8) -> AppResult<Vec<TmdbResult>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    let client = http()?;

    // Try multiple prefixes to get broader coverage
    let chars_to_try: Vec<char> = query
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .take(3)
        .collect();

    let mut tried_urls = std::collections::HashSet::new();

    for ch in chars_to_try {
        let enc = crate::media::subkade::utf8_percent_encode_pub(query);
        let url = format!(
            "https://v2.sg.media-imdb.com/suggestion/{}/{}.json",
            ch.to_ascii_lowercase(),
            enc
        );
        if !tried_urls.insert(url.clone()) {
            continue;
        }

        if let Ok(resp) = client.get(&url).send() {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>() {
                    if let Some(d) = json["d"].as_array() {
                        for item in d {
                            let q_type = item["q"].as_str().unwrap_or_default();
                            if q_type != "feature"
                                && q_type != "tvSeries"
                                && q_type != "tvMiniSeries"
                            {
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
                                .unwrap_or_else(|_| {
                                    id_str.bytes().fold(0, |acc, b| acc.wrapping_add(b as u64))
                                });

                            let is_tv = q_type.contains("tv");
                            let poster_url = item["i"]["imageUrl"]
                                .as_str()
                                .unwrap_or_default()
                                .to_string();
                            let rank = item["rank"].as_u64().map(|r| r as u32).unwrap_or(999999);

                            if !out.iter().any(|r: &TmdbResult| r.id == id) {
                                out.push(TmdbResult {
                                    id,
                                    title,
                                    year,
                                    is_tv,
                                    poster_url,
                                    rank,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Also search OMDb to ensure comprehensive results
    if let Ok(omdb_results) = search_omdb(query, api_key, 20) {
        for r in omdb_results {
            if !out.iter().any(|existing| {
                existing.id == r.id || existing.title.eq_ignore_ascii_case(&r.title)
            }) {
                out.push(r);
            }
        }
    }

    // Sort by rank ascending (lower rank number means higher popularity/importance in IMDb)
    out.sort_by_key(|r| r.rank);

    // Truncate to requested limit
    out.truncate(limit as usize);

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
        for (idx, item) in items.iter().enumerate() {
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
                .and_then(|s| s.trim_start_matches('t').parse::<u64>().ok())
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
                // OMDb doesn't give rank, assign based on order + offset
                rank: 50000 + (idx as u32),
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
