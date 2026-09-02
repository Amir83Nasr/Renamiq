pub mod languages;
pub mod noise;
mod normalize;
mod tokens;

use serde::{Deserialize, Serialize};

use normalize::{ascii_digits, split_stem_and_ext, tokenize};

/// Parsed metadata extracted from a media filename.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedMedia {
    pub filename: String,
    pub kind: MediaKind,
    pub title: String,
    pub year: Option<u16>,
    pub season: Option<u8>,
    pub episode: Option<u8>,
    /// Extra episodes for multi-episode files (S01E01E02 → [2]).
    pub episodes: Option<Vec<u8>>,
    pub resolution: Option<String>,
    pub codec: Option<String>,
    pub audio: Option<String>,
    pub language: Option<String>,
    pub group: Option<String>,
    pub edition: Option<String>,
    /// True when the title is a short guess or the kind is ambiguous.
    pub low_confidence: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Movie,
    Tv,
    Unknown,
}

impl ParsedMedia {
    fn unknown(filename: &str) -> Self {
        ParsedMedia {
            filename: filename.to_string(),
            kind: MediaKind::Unknown,
            title: String::new(),
            year: None,
            season: None,
            episode: None,
            episodes: None,
            resolution: None,
            codec: None,
            audio: None,
            language: None,
            group: None,
            edition: None,
            low_confidence: true,
        }
    }
}

/// Parse a media filename into structured metadata.
///
/// Strategy: find the strongest structural marker first (season/episode
/// pattern → TV; standalone year → movie), split title from noise at that
/// marker, then classify remaining trailing tokens.
pub fn parse_filename(raw: &str) -> ParsedMedia {
    let raw = ascii_digits(raw);
    let (stem, _ext) = split_stem_and_ext(&raw);
    let tokens = tokenize(stem);
    // Hyphenated tokens hiding an S/E marker ("Squid-Game-S01-E04") split
    // into segments first; everything else keeps hyphens intact.
    let tokens = tokens::expand_hyphen_markers(&tokens);

    if let Some(hit) = tokens::find_episode_marker(&tokens) {
        return parse_tv(stem, &tokens, hit);
    }
    if let Some(year) = tokens::find_year_marker(&tokens) {
        return parse_movie(stem, &tokens, year);
    }
    // No marker: treat everything before the first noise token as title.
    parse_unmarked(stem, &tokens)
}

fn parse_tv(stem: &str, tokens: &[String], hit: tokens::EpisodeHit) -> ParsedMedia {
    let mut out = base(stem, MediaKind::Tv);
    out.season = Some(hit.season);
    out.episode = Some(hit.episode);
    if hit.extra_episodes.len() > 1 {
        out.episodes = Some(hit.extra_episodes.clone());
    }
    let title_tokens = &tokens[..hit.index];
    out.title = join_title(title_tokens);
    out.low_confidence = out.title.is_empty() || out.title.chars().count() < 3;
    classify_tail(tokens, hit.end_index(), &mut out, true);
    out
}

fn parse_movie(stem: &str, tokens: &[String], year_idx: usize) -> ParsedMedia {
    let mut out = base(stem, MediaKind::Movie);
    // Year may sit inside a hyphenated token ("Toy-Story-5-2026-DUB").
    let year_token = &tokens[year_idx];
    let embedded_year = year_token
        .split('-')
        .find(|seg| seg.len() == 4 && seg.chars().all(|c| c.is_ascii_digit()));
    let year_str = embedded_year.unwrap_or(year_token.trim_matches(|c: char| !c.is_ascii_digit()));
    out.year = year_str.parse().ok();
    // When the year was embedded, text before it in the same token is
    // title ("Toy-Story-5" ← "Toy-Story-5-2026-DUB").
    let mut title_tokens: Vec<String> = tokens[..year_idx].to_vec();
    if let Some(y) = embedded_year {
        if let Some((prefix, _)) = year_token.split_once(&format!("-{y}")) {
            if !prefix.is_empty() {
                title_tokens.push(prefix.to_string());
            }
        }
    }
    out.title = join_title(&title_tokens);
    out.low_confidence = out.title.is_empty() || out.title.chars().count() < 3;
    classify_tail(tokens, year_idx + 1, &mut out, false);
    out
}

fn parse_unmarked(stem: &str, tokens: &[String]) -> ParsedMedia {
    let cut = tokens
        .iter()
        .position(|t| noise::is_noise(t, true))
        .unwrap_or(tokens.len());
    let mut out = base(stem, MediaKind::Unknown);
    out.title = join_title(&tokens[..cut]);
    out.low_confidence = true;
    classify_tail(tokens, cut, &mut out, false);
    out
}

/// Classify tokens after the title/marker position into metadata fields.
fn classify_tail(tokens: &[String], start: usize, out: &mut ParsedMedia, _after_marker: bool) {
    let tail = &tokens[start.min(tokens.len())..];

    // Release group: a hyphenated token at the end whose part after the last
    // dash is not itself noise ("x265-GROUP" → GROUP; codec part before the
    // dash still gets classified below).
    let mut meta_end = tail.len();
    let mut group_prefix: Option<&str> = None;
    if let Some(last) = tail.last() {
        if let Some((before, after)) = split_group_token(last) {
            // Scene convention: trailing dash segment is the group. Exclude
            // pure source tags whose WHOLE token normalizes to a known
            // noise word ("WEB-DL" → webdl).
            let joined = format!("{before}{after}");
            if !noise::is_noise(&joined, true) && !noise::is_noise(after, false) {
                out.group = Some(after.to_string());
                meta_end = tail.len() - 1;
                group_prefix = Some(before);
            }
        }
    }

    let mut meta_tokens: Vec<String> = tail[..meta_end].to_vec();
    if let Some(prefix) = group_prefix {
        meta_tokens.push(prefix.to_string());
    }

    for token in &meta_tokens {
        let t = token.as_str();
        match t {
            _ if t.parse::<u16>().is_ok() && t.len() >= 3 && out.year.is_none() => {
                out.year = t.parse().ok();
            }
            _ if is_resolution(t) => out.resolution = Some(canonical_resolution(t)),
            _ if is_codec(t) => out.codec = Some(codec_name(t)),
            _ if is_audio(t) => out.audio = Some(t.to_uppercase()),
            _ if is_edition(t) => out.edition = Some(capitalize(t)),
            _ => {}
        }
    }
}

/// "x265-GROUP" → ("x265", "GROUP"); "264-NTb" → ("264", "NTb").
fn split_group_token(token: &str) -> Option<(&str, &str)> {
    let idx = token.rfind('-')?;
    if idx == 0 || idx == token.len() - 1 {
        return None;
    }
    Some((&token[..idx], &token[idx + 1..]))
}

fn codec_name(t: &str) -> String {
    t.split('-')
        .next()
        .unwrap_or(t)
        .trim_matches(['.', '-'])
        .to_uppercase()
}

fn is_resolution(t: &str) -> bool {
    let l = t.to_lowercase();
    ["2160p", "1080p", "1080i", "720p", "576p", "540p", "480p"].contains(&l.as_str())
}

fn canonical_resolution(t: &str) -> String {
    t.to_lowercase()
}

fn is_codec(t: &str) -> bool {
    matches!(
        t.to_lowercase().as_str(),
        "x264" | "x265" | "h264" | "h.264" | "h265" | "h.265" | "hevc" | "av1" | "avc" | "xvid"
    )
}

fn is_audio(t: &str) -> bool {
    let l = t.to_lowercase();
    l.starts_with("dd")
        || l.starts_with("dts")
        || ["aac", "ac3", "eac3", "flac", "atmos", "truehd"].contains(&l.as_str())
}

fn is_edition(t: &str) -> bool {
    matches!(
        t.to_lowercase().as_str(),
        "proper" | "repack" | "extended" | "uncut" | "remastered" | "imax"
    )
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// Join title tokens with spaces and clean punctuation edges. Hyphen-joined
/// scene titles ("Jack-Reaper") become spaces; standalone dashes vanish.
/// Converts to title case (capitalizes major words, keeps minor words lowercase unless first/last).
fn join_title(tokens: &[String]) -> String {
    let raw_tokens: Vec<String> = tokens
        .iter()
        .flat_map(|t| t.split('-'))
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();

    if raw_tokens.is_empty() {
        return String::new();
    }

    let minor_words = [
        "of", "the", "and", "in", "on", "at", "to", "for", "a", "an", "with", "by", "from",
    ];

    raw_tokens
        .iter()
        .enumerate()
        .map(|(i, word)| {
            let lower = word.to_lowercase();
            let is_first_or_last = i == 0 || i == raw_tokens.len() - 1;
            if !is_first_or_last && minor_words.contains(&lower.as_str()) {
                lower
            } else {
                capitalize(word)
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn base(filename: &str, kind: MediaKind) -> ParsedMedia {
    let mut p = ParsedMedia::unknown(filename);
    p.kind = kind;
    p.low_confidence = false;
    p
}

#[cfg(test)]
mod tests {
    use super::*;

    fn title_of(name: &str) -> String {
        parse_filename(name).title
    }

    #[test]
    fn tv_standard_sxxexx() {
        let p = parse_filename("Breaking.Bad.S01E01.1080p.WEB-DL.x265-GROUP.mkv");
        assert_eq!(p.kind, MediaKind::Tv);
        assert_eq!(p.title, "Breaking Bad");
        assert_eq!(p.season, Some(1));
        assert_eq!(p.episode, Some(1));
        assert_eq!(p.resolution.as_deref(), Some("1080p"));
        assert_eq!(p.codec.as_deref(), Some("X265"));
        assert_eq!(p.group.as_deref(), Some("GROUP"));
    }

    #[test]
    fn tv_single_digit_se() {
        let p = parse_filename("House of dragons S2E7.mkv");
        assert_eq!(p.kind, MediaKind::Tv);
        assert_eq!(p.title, "House of Dragons");
        assert_eq!(p.season, Some(2));
        assert_eq!(p.episode, Some(7));
    }

    #[test]
    fn tv_1x01_pattern() {
        let p = parse_filename("Breaking.Bad.1x02.1080p.WEBRip.x264.mkv");
        assert_eq!(p.kind, MediaKind::Tv);
        assert_eq!(p.title, "Breaking Bad");
        assert_eq!(p.season, Some(1));
        assert_eq!(p.episode, Some(2));
    }

    #[test]
    fn tv_multi_episode() {
        let p = parse_filename("Show.Name.S01E01E02.720p.HDTV.mkv");
        assert_eq!(p.season, Some(1));
        assert_eq!(p.episode, Some(1));
        assert_eq!(p.episodes, Some(vec![1, 2]));
    }

    #[test]
    fn movie_with_year() {
        let p = parse_filename("Obsession.2026.1080p.WEB-DL.x265-GROUP.mkv");
        assert_eq!(p.kind, MediaKind::Movie);
        assert_eq!(p.title, "Obsession");
        assert_eq!(p.year, Some(2026));
    }

    #[test]
    fn movie_bluray() {
        let p = parse_filename("Inception.2010.1080p.BluRay.x264.mkv");
        assert_eq!(p.title, "Inception");
        assert_eq!(p.year, Some(2010));
        assert_eq!(p.resolution.as_deref(), Some("1080p"));
    }

    #[test]
    fn title_words_preserved_after_dots() {
        assert_eq!(
            title_of("The.Last.of.Us.S02E03.1080p.WEB-DL.DDP5.1.H.264-NTb.mkv"),
            "The Last of Us"
        );
        assert_eq!(
            parse_filename("The.Last.of.Us.S02E03.1080p.WEB-DL.DDP5.1.H.264-NTb.mkv")
                .group
                .as_deref(),
            Some("NTb")
        );
    }

    #[test]
    fn numbers_in_title_kept() {
        // "1997" here is part of the show name, not a year — but with an
        // episode marker the whole prefix is title, so it survives.
        assert_eq!(title_of("Dekalog.1989.S01E05.480p.mkv"), "Dekalog 1989");
    }

    #[test]
    fn unicode_and_persian_filename() {
        let p = parse_filename("شهرزاد.قسمت.۱.فصل.۱.mkv");
        assert!(!p.title.is_empty());
    }

    #[test]
    fn no_extension_input_ok() {
        let p = parse_filename("Some Movie 2019 1080p");
        assert_eq!(p.title, "Some Movie");
        assert_eq!(p.year, Some(2019));
    }

    #[test]
    fn garbage_returns_unknown_low_confidence() {
        let p = parse_filename("x264_final_render_export");
        assert_eq!(p.kind, MediaKind::Unknown);
        assert!(p.low_confidence);
    }

    #[test]
    fn persian_digits_parsed() {
        let p = parse_filename("قسمت.۰۱.فصل.۰۲.mkv");
        assert_eq!(p.season, Some(2));
        assert_eq!(p.episode, Some(1));
    }

    #[test]
    fn hyphen_title_joined() {
        let p = parse_filename("Jack-Reaper.2020.1080p.WEB-DL.mkv");
        assert_eq!(p.title, "Jack Reaper");
        assert_eq!(p.year, Some(2020));
    }

    #[test]
    fn hyphenated_tv_marker() {
        let p = parse_filename("Squid-Game-S01-E04.mkv");
        assert_eq!(p.kind, MediaKind::Tv);
        assert_eq!(p.title, "Squid Game");
        assert_eq!(p.season, Some(1));
        assert_eq!(p.episode, Some(4));
    }

    #[test]
    fn hyphenated_combined_marker() {
        let p = parse_filename("Money-Heist-S02E09.1080p.mkv");
        assert_eq!(p.kind, MediaKind::Tv);
        assert_eq!(p.title, "Money Heist");
        assert_eq!(p.season, Some(2));
        assert_eq!(p.episode, Some(9));
        assert_eq!(p.resolution.as_deref(), Some("1080p"));
    }
}
