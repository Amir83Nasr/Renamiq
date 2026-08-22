/// Release-noise tokens removed from filenames. Matched case-insensitively
/// after stripping separator characters (`.-_ `). Multi-part tokens like
/// "WEB DL" are compared in that normalized form.
pub const NOISE_TOKENS: &[&str] = &[
    // Resolution
    "2160p", "1080p", "1080i", "720p", "576p", "540p", "480p", "4k", "8k",
    // Source
    "webdl", "web dl", "webrip", "web", "bluray", "blu ray", "bdrip", "bd",
    "brrip", "dvdrip", "dvd", "hdrip", "hdtv", "pdtv", "remux", "hc",
    // Codecs
    "x264", "x265", "xvid", "divx", "h264", "h265", "h 264", "h 265",
    "avc", "hevc", "av1", "vp9", "mpeg2", "vc1",
    "10bit", "8bit", "hdr", "hdr10", "hdr10plus", "dolby vision", "dv",
    // Audio
    "aac", "ac3", "eac3", "dd", "ddp", "ddplus", "ddp5 1", "dd5 1", "dd7 1",
    "dts", "dtshd", "dts hd", "truehd", "atmos", "dolby atmos", "flac",
    "mp3", "opus", "truehdd", "thd",
    // Editions / flags
    "proper", "repack", "extended", "uncut", "uncensored", "remastered",
    "imax", "hybrid", "internal", "limited", "complete", "dual audio",
    "ws", "nfo", "read nfo",
    // Scene site tags
    "rarbg", "yts", "yify", "eztv", "ettv", "torrentgalaxy", "tgx",
    "galaxyrg", "hdatmos", "dsnp", "amzn", "nf", "atvp", "hmax", "max",
    "pmtp", "it", "stv", "cr", "pcok", "orarbg", "rarbg com",
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
