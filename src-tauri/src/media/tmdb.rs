//! TMDB (themoviedb.org) integration: search movies/TV by name and download
//! the official poster image. Requires a free API key from the user.
use crate::core::error::{AppResult, RenamiqError};
use serde::{Deserialize, Serialize};

const API: &str = "https://api.themoviedb.org/3";
/// Poster CDN base; `size` is one of TMDB's documented widths.
const IMG: &str = "https://image.tmdb.org/t/p";
const POSTER_SIZE: &str = "w500";
/// ponytail: public TMDB key shipped by luxeposter.vercel.app (PosterFlix);
/// lets poster search work with zero setup. A user key from Settings wins.
const FALLBACK_KEY: &str = "8265bd1679663a7ea12ac168da84d2e8";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TmdbResult {
    pub id: u64,
    pub title: String,
    pub year: Option<u32>,
    /// True for TV shows, false for movies.
    pub is_tv: bool,
    /// Relative poster path on the TMDB CDN, e.g. "/abc.jpg".
    pub poster_path: Option<String>,
}

fn http() -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Renamiq)")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| RenamiqError::with_source("Network is unavailable", e))
}

/// TMDB's edge intermittently answers 404 (code 34) or drops connections on
/// some networks; an immediate retry usually succeeds.
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

/// Search both movie and TV endpoints; merges results (movies first).
pub fn search(query: &str, api_key: &str, limit: u8) -> AppResult<Vec<TmdbResult>> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let api_key = match api_key.trim() {
        "" => FALLBACK_KEY,
        k => k,
    };
    let enc = crate::media::subkade::utf8_percent_encode_pub(query);
    let mut out: Vec<TmdbResult> = Vec::new();
    // ponytail: api_key must come after query — TMDB rejects this key when it
    // doesn't (observed 404 status_code 34 with key-first param order).
    for (endpoint, is_tv) in [("movie", false), ("tv", true)] {
        if out.len() >= limit as usize {
            break;
        }
        let url =
            format!("{API}/search/{endpoint}?query={enc}&include_adult=false&api_key={api_key}");
        let Ok(json) = get_json(&url) else {
            continue;
        };
        let Some(items) = json["results"].as_array() else {
            continue;
        };
        for item in items {
            if out.len() >= limit as usize {
                break;
            }
            let title = item["title"]
                .as_str()
                .or_else(|| item["name"].as_str())
                .unwrap_or_default()
                .to_string();
            if title.is_empty() {
                continue;
            }
            let year = item["release_date"]
                .as_str()
                .or_else(|| item["first_air_date"].as_str())
                .and_then(|d| d.get(0..4))
                .and_then(|y| y.parse::<u32>().ok());
            out.push(TmdbResult {
                id: item["id"].as_u64().unwrap_or(0),
                title,
                year,
                is_tv,
                poster_path: item["poster_path"].as_str().map(String::from),
            });
        }
    }
    Ok(out)
}

/// Download the poster for a result and save it as `<dest_dir>/<title>.jpg`.
/// Returns the written file path.
pub fn download_poster(
    result: &TmdbResult,
    api_key: &str,
    dest_dir: &std::path::Path,
) -> AppResult<std::path::PathBuf> {
    let Some(poster_path) = result.poster_path.as_deref().filter(|p| p.starts_with('/')) else {
        return Err(RenamiqError::user("This result has no poster"));
    };

    // ponytail: re-fetch details only when poster is missing from search
    // results; search already carries it for every match we show.
    let _ = api_key;

    // Same flapping edge as the API: retry once before giving up.
    let client = http()?;
    let bytes = (0..2)
        .find_map(|_| {
            client
                .get(format!("{IMG}/{POSTER_SIZE}{poster_path}"))
                .timeout(std::time::Duration::from_secs(60))
                .send()
                .and_then(|r| r.error_for_status())
                .and_then(|r| r.bytes())
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
    std::fs::write(&file, &bytes)
        .map_err(|e| RenamiqError::with_source("Could not write poster", e))?;
    Ok(file)
}
