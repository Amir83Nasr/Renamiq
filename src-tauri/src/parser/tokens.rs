//! Structural markers: season/episode patterns and year positions.

#[cfg(test)]
use crate::parser::normalize::tokenize;

pub struct EpisodeHit {
    /// Token index of the marker's first token.
    pub index: usize,
    pub season: u8,
    pub episode: u8,
    /// All episodes covered (for multi-episode files), starting at `episode`.
    pub extra_episodes: Vec<u8>,
    /// First token index after the marker.
    end_index: usize,
}

impl EpisodeHit {
    pub fn end_index(&self) -> usize {
        self.end_index
    }
}

/// Find the strongest S/E marker in `tokens`. Returns the earliest match of
/// the strongest pattern class (SxxExx beats 1x01).
pub fn find_episode_marker(tokens: &[String]) -> Option<EpisodeHit> {
    let mut best: Option<(u8, EpisodeHit)> = None; // (pattern strength, hit)

    for i in 0..tokens.len() {
        if let Some(hit) = try_sxxexx_at(i, tokens) {
            if best.as_ref().is_none_or(|(s, _)| *s < 3) {
                best = Some((3, hit));
            }
        } else if let Some(hit) = try_sx_ep_at(i, tokens) {
            if best.is_none() {
                best = Some((2, hit));
            }
        }
    }
    best.map(|(_, hit)| hit)
}

/// "S01E01", also split across tokens ("S01" + "E01").
fn try_sxxexx_at(i: usize, tokens: &[String]) -> Option<EpisodeHit> {
    let t = &tokens[i];
    if let Some((s, e)) = parse_se_token(t) {
        let season_end = 1 + t[1..].to_lowercase().find('e').unwrap_or(t.len() - 1);
        return finish_hit(i, s, vec![e], 1, season_end, tokens);
    }
    // Split form: "S01 E01"
    if t.len() >= 2
        && (t.starts_with('S') || t.starts_with('s'))
        && t[1..].chars().all(|c| c.is_ascii_digit())
        && i + 1 < tokens.len()
    {
        let next = &tokens[i + 1];
        let n = next.trim_start_matches(['E', 'e']);
        if n.len() < next.len() && n.chars().all(|c| c.is_ascii_digit()) {
            if let (Ok(s), Ok(e)) = (t[1..].parse::<u8>(), n.parse::<u8>()) {
                return finish_hit(i, s, vec![e], 2, t.len(), tokens);
            }
        }
    }
    None
}

/// "S01E01" (also "S01E01E02") single-token form → (season, first episode).
/// Multi-episode tails are picked up by `extend_episodes` via the hit.
fn parse_se_token(t: &str) -> Option<(u8, u8)> {
    let l = t.to_lowercase();
    let bytes = l.as_bytes();
    if bytes.len() < 4 || bytes[0] != b's' {
        return None;
    }
    let mid = l[1..].find('e')? + 1;
    let s = l[1..mid].parse::<u8>().ok()?;
    let rest = &l[mid + 1..];
    // First E-segment only; trailing digits after the next 'e' belong to
    // extra episodes handled in extend_episodes via end_index math below.
    let seg_len = rest.find('e').unwrap_or(rest.len());
    let e = rest[..seg_len].parse::<u8>().ok()?;
    Some((s, e))
}

/// Multi-episode continuation: extra "E02" segments in the SAME token
/// ("S01E01E02") or adjacent tokens ("S01E01" + "E02").
/// `eps` starts as [first episode]; returns all episodes in order.
fn extend_episodes(
    mut eps: Vec<u8>,
    index: usize,
    season_digits_end: usize,
    tokens: &[String],
) -> Vec<u8> {
    let lower = tokens[index].to_lowercase();

    // 1. Same-token tail: everything after `season_digits_end` is a run of
    //    E-segments: "e01e02". The first segment IS the episode already in
    //    eps, so skip it and collect only extra ones.
    if season_digits_end <= lower.len() {
        let mut rest = &lower[season_digits_end..];
        // Skip first E-segment (already recorded).
        if let Some(after_e) = rest.strip_prefix('e') {
            let digits: String = after_e.chars().take_while(|c| c.is_ascii_digit()).collect();
            rest = &after_e[digits.len()..];
        }
        while let Some(after_e) = rest.strip_prefix('e') {
            let digits: String = after_e.chars().take_while(|c| c.is_ascii_digit()).collect();
            if digits.is_empty() || eps.len() > 20 {
                break;
            }
            if let Ok(e) = digits.parse::<u8>() {
                eps.push(e);
                rest = &after_e[digits.len()..];
            } else {
                break;
            }
        }
    }

    // 2. Adjacent-token continuation: "S01E01" "E02".
    let mut idx = index + 1;
    while let Some(t) = tokens.get(idx) {
        let l = t.to_lowercase();
        if let Some(digits) = l.strip_prefix('e') {
            if !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()) {
                if let Ok(e) = digits.parse::<u8>() {
                    eps.push(e);
                    idx += 1;
                    continue;
                }
            }
        }
        break;
    }
    eps
}

/// Finish an EpisodeHit. `consumed` = token count the base marker spans;
/// `season_digits_end` = char offset where season digits end in that token.
fn finish_hit(
    index: usize,
    season: u8,
    episodes: Vec<u8>,
    consumed: usize,
    season_digits_end: usize,
    tokens: &[String],
) -> Option<EpisodeHit> {
    if episodes.is_empty() {
        return None;
    }
    let episode = episodes[0];
    let all = extend_episodes(episodes, index, season_digits_end, tokens);
    // Same-token extras add no token count; only "E02"-style neighbors do.
    let end_index = index + consumed + adjacent_extra_count(&tokens[index + 1..]);
    Some(EpisodeHit {
        index,
        season,
        episode,
        extra_episodes: all,
        end_index,
    })
}

/// How many following tokens are pure "E02"-style continuations.
fn adjacent_extra_count(tokens: &[String]) -> usize {
    let mut n = 0;
    for t in tokens {
        let l = t.to_lowercase();
        if let Some(digits) = l.strip_prefix('e') {
            if !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()) {
                n += 1;
                continue;
            }
        }
        break;
    }
    n
}

/// Weak patterns only considered when no strong SxxExx exists anywhere:
/// "1x01", "01x01", "Season 1 Episode 1", "فصل ۲ قسمت ۱".
fn try_sx_ep_at(i: usize, tokens: &[String]) -> Option<EpisodeHit> {
    let t = &tokens[i];
    if let Some(x) = t.find(['x', 'X']) {
        let (a, b) = (&t[..x], &t[x + 1..]);
        if !a.is_empty()
            && !b.is_empty()
            && a.chars().all(|c| c.is_ascii_digit())
            && b.chars().all(|c| c.is_ascii_digit())
        {
            if let (Ok(s), Ok(e)) = (a.parse::<u8>(), b.parse::<u8>()) {
                return finish_hit(i, s, vec![e], 1, t.len(), tokens);
            }
        }
        return None;
    }
    // "Season 1 … Episode 2" / "فصل ۲ … قسمت ۱" / Persian order "قسمت ۱ فصل ۲".
    // Word followed by a number; the paired word+number must appear nearby.
    if (is_season_word(t) || is_episode_word(t)) && i + 1 < tokens.len() {
        if let Ok(n1) = tokens[i + 1].parse::<u8>() {
            let first_is_season = is_season_word(t);
            for j in (i + 2)..tokens.len().min(i + 6) {
                let marker = is_episode_word(&tokens[j]) || is_season_word(&tokens[j]);
                if !marker {
                    continue;
                }
                if let Some(n2) = tokens.get(j + 1).and_then(|n| n.parse::<u8>().ok()) {
                    // Season-word-first or episode-word-second → (n1, n2) is
                    // (season, episode); otherwise the pair is reversed.
                    let swapped = !first_is_season && is_season_word(&tokens[j]);
                    let (s, e) = if swapped { (n2, n1) } else { (n1, n2) };
                    let consumed = j + 2 - i;
                    return finish_hit(i, s, vec![e], consumed, t.len(), tokens);
                }
            }
        }
    }
    None
}

/// Season/episode words, English and Persian ("فصل ۲ قسمت ۱").
fn is_season_word(t: &str) -> bool {
    t.eq_ignore_ascii_case("season") || t == "فصل"
}

fn is_episode_word(t: &str) -> bool {
    t.eq_ignore_ascii_case("episode") || t.eq_ignore_ascii_case("ep") || t == "قسمت"
}

/// Index of a plausible release-year token. Requires 1900–2100 and that the
/// token is delimited (not part of a longer number like "2010p" or "12010").
/// A year buried in a hyphenated token ("Toy-Story-5-2026-DUB") counts too.
pub fn find_year_marker(tokens: &[String]) -> Option<usize> {
    tokens.iter().position(|t| {
        let clean = t.trim_matches(|c: char| !c.is_ascii_alphanumeric());
        if clean.len() == 4
            && clean.chars().all(|c| c.is_ascii_digit())
            && clean
                .parse::<u16>()
                .is_ok_and(|y| (1900..=2100).contains(&y))
        {
            return true;
        }
        // Hyphenated token with an embedded delimited segment: "-2026-" or
        // leading/trailing dash around the digits.
        t.split('-').any(|seg| {
            seg.len() == 4
                && seg.chars().all(|c| c.is_ascii_digit())
                && seg.parse::<u16>().is_ok_and(|y| (1900..=2100).contains(&y))
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn toks(s: &str) -> Vec<String> {
        tokenize(s)
    }

    #[test]
    fn finds_sxxexx() {
        let hit = find_episode_marker(&toks("Breaking Bad S01E01 1080p")).unwrap();
        assert_eq!((hit.season, hit.episode), (1, 1));
        assert_eq!(hit.index, 2);
        assert_eq!(hit.end_index(), 3);
    }

    #[test]
    fn finds_single_digit_sxxexx() {
        let hit = find_episode_marker(&toks("House of dragons S2E7 1080p")).unwrap();
        assert_eq!((hit.season, hit.episode), (2, 7));

        let hit2 = find_episode_marker(&toks("House of dragons S02E7 1080p")).unwrap();
        assert_eq!((hit2.season, hit2.episode), (2, 7));

        let hit3 = find_episode_marker(&toks("House of dragons S2E07 1080p")).unwrap();
        assert_eq!((hit3.season, hit3.episode), (2, 7));
    }

    #[test]
    fn multi_episode_extends() {
        // Same-token extras: marker occupies ONE token (index 2).
        let hit = find_episode_marker(&toks("Show Name S01E01E02 720p")).unwrap();
        assert_eq!(hit.extra_episodes, vec![1, 2]);
        assert_eq!(hit.end_index(), 3);

        // Adjacent-token extras consume the extra token.
        let split = find_episode_marker(&toks("Show Name S01E01 E02 720p")).unwrap();
        assert_eq!(split.extra_episodes, vec![1, 2]);
        assert_eq!(split.end_index(), 4);
    }

    #[test]
    fn year_bounds() {
        assert!(find_year_marker(&toks("Movie 2010 BluRay")).is_some());
        assert!(find_year_marker(&toks("Movie 1810 BluRay")).is_none());
        assert!(find_year_marker(&toks("Resident Evil 2100p")).is_none());
    }

    #[test]
    fn season_word_form() {
        let hit = find_episode_marker(&toks("Friends Season 1 Episode 3")).unwrap();
        assert_eq!((hit.season, hit.episode), (1, 3));
        assert_eq!(hit.index, 1);
    }
}
