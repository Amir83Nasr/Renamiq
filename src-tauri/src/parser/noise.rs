/// Release-noise tokens removed from filenames. Matched case-insensitively
/// after stripping separator characters (`.-_ `). Multi-part tokens like
/// "WEB DL" are compared in that normalized form.
pub const NOISE_TOKENS: &[&str] = &[
    // Resolution
    "2160p", "1080p", "1080i", "720p", "576p", "540p", "480p", "4k", "8k",
    // Source
    "webdl", "webdl2", "webrip", "web", "bluray", "blurayremux", "bdrip", "bd",
    "brrip", "dvdrip", "dvd", "hdrip", "hdtv", "pdtv", "remux", "hc",
    // Codecs
    "x264", "x265", "xvid", "divx", "h264", "h265", "h2642", "avc", "hevc",
    "av1", "vp9", "mpeg2", "vc1", "10bit", "8bit", "hdr", "hdr10",
    "hdr10plus", "dolbyvision", "dv",
    // Audio
    "aac", "ac3", "eac3", "dd", "ddp", "ddplus", "ddp51", "dd51", "dd71",
    "dts", "dtshd", "dtshdma", "truehd", "atmos", "dolbyatmos", "flac",
    "mp3", "opus",
    // Editions / flags
    "proper", "repack", "extended", "uncut", "uncensored", "remastered",
    "imax", "hybrid", "internal", "limited", "complete", "dualaudio",
    "nfo", "readnfo",
    // Scene site tags
    "rarbg", "yts", "yify", "eztv", "ettv", "torrentgalaxy", "tgx",
    "galaxyrg", "dsnp", "amzn", "nf", "atvp", "hmax", "pmtp", "stv",
    "orarbg",
];

/// Tokens that look like noise but can be part of a title (e.g. the movie
/// "Up"). Only stripped when they appear AFTER the episode/year marker.
pub const CONTEXTUAL_NOISE_TOKENS: &[&str] = &["up", "it"];

/// Returns true when `token` is release noise. `after_marker` marks tokens
/// found after the season/episode or year position, where contextual words
/// are also safe to drop.
pub fn is_noise(token: &str, after_marker: bool) -> bool {
    let normalized = normalize_token(token);
    if normalized.is_empty() {
        return true;
    }
    if NOISE_TOKENS.contains(&normalized.as_str()) {
        return true;
    }
    if after_marker && CONTEXTUAL_NOISE_TOKENS.contains(&normalized.as_str()) {
        return true;
    }
    false
}

/// Lowercase and strip `.`, `-`, `_`, spaces so "Web-DL" == "webdl".
fn normalize_token(token: &str) -> String {
    token
        .to_lowercase()
        .chars()
        .filter(|c| !matches!(c, '.' | '-' | '_' | ' '))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_common_noise() {
        for t in ["1080p", "WEB-DL", "webdl", "BluRay", "x265", "H.264", "DDP5.1", "Atmos"] {
            assert!(is_noise(t, false), "{t} should be noise");
        }
    }

    #[test]
    fn group_names_are_not_in_list() {
        // Groups are handled separately by the trailing-dash heuristic.
        assert!(!is_noise("NTb", false));
        assert!(!is_noise("GROUP", false));
    }

    #[test]
    fn contextual_only_after_marker() {
        assert!(!is_noise("Up", false), "title word kept before marker");
        assert!(is_noise("Up", true), "dropped after SxxExx");
    }
}
