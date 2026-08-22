//! Naming templates: `{title} {year}` → "Obsession 2026".
//! Supported variables: title, year, season, episode, resolution, codec,
//! language. `{season:02}` pads to 2 digits.

use crate::parser::{MediaKind, ParsedMedia};

/// Substitute template variables with parsed metadata.
/// Unknown variables are left as-is so users can spot typos in preview.
pub fn render_template(template: &str, parsed: &ParsedMedia) -> String {
    let mut out = String::with_capacity(template.len());
    let mut rest = template;

    while let Some(start) = rest.find('{') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('}') {
            Some(end) => {
                let var = &after[..end];
                out.push_str(&variable_value(var, parsed));
                rest = &after[end + 1..];
            }
            None => {
                // Unterminated brace: emit literally.
                out.push('{');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    sanitize_filename(&out)
}

fn variable_value(var: &str, p: &ParsedMedia) -> String {
    let (name, pad) = match var.split_once(':') {
        Some((n, spec)) if spec == "02" || spec == "2" => (n, 2),
        _ => (var, 0),
    };
    let raw = match name {
        "title" => p.title.clone(),
        "year" => p.year.map(|y| y.to_string()).unwrap_or_default(),
        "season" => p.season.map(|s| s.to_string()).unwrap_or_default(),
        "episode" => p.episode.map(|e| e.to_string()).unwrap_or_default(),
        "resolution" => p.resolution.clone().unwrap_or_default(),
        "codec" => p.codec.clone().unwrap_or_default(),
        "language" => p.language.clone().unwrap_or_default(),
        _ => return format!("{{{var}}}"), // keep unknown vars visible
    };
    if pad > 0 && !raw.is_empty() {
        format!("{raw:0>pad$}")
    } else {
        raw
    }
}

/// Strip characters illegal in filenames across macOS/Windows/Linux.
pub fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => ' ',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    cleaned.trim().to_string()
}

/// Default templates per media kind (configurable later via settings).
pub fn default_template(kind: MediaKind) -> &'static str {
    match kind {
        MediaKind::Movie => "{title} {year}",
        MediaKind::Tv => "{title} S{season:02} E{episode:02}",
        MediaKind::Unknown => "{title}",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tv_parsed() -> ParsedMedia {
        ParsedMedia {
            filename: "test.mkv".into(),
            kind: MediaKind::Tv,
            title: "Breaking Bad".into(),
            year: None,
            season: Some(1),
            episode: Some(1),
            episodes: None,
            resolution: Some("1080p".into()),
            codec: Some("X265".into()),
            audio: None,
            language: None,
            group: None,
            edition: None,
            low_confidence: false,
        }
    }

    #[test]
    fn movie_template() {
        let mut p = tv_parsed();
        p.kind = MediaKind::Movie;
        p.season = None;
        p.episode = None;
        p.year = Some(2026);
        p.title = "Obsession".into();
        assert_eq!(render_template(default_template(MediaKind::Movie), &p), "Obsession 2026");
    }

    #[test]
    fn tv_template_pads() {
        assert_eq!(
            render_template(default_template(MediaKind::Tv), &tv_parsed()),
            "Breaking Bad S01 E01"
        );
    }

    #[test]
    fn unknown_variable_kept() {
        assert_eq!(
            render_template("{title} {bogus}", &tv_parsed()),
            "Breaking Bad {bogus}"
        );
    }

    #[test]
    fn sanitizes_illegal_chars() {
        let mut p = tv_parsed();
        p.title = "Movie: The Reckoning?".into();
        assert!(!render_template("{title}", &p).contains(':'));
        assert!(!render_template("{title}", &p).contains('?'));
    }
}
