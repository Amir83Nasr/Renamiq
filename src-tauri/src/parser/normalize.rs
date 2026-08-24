/// Filename → token list. Separators (`.`, `_`, space) become boundaries.
/// Hyphens stay INSIDE tokens (`WEB-DL`, `x265-GROUP`) so release groups can
/// be recovered from the last dash later; noise matching normalizes dashes.
/// Split "name.ext" into ("name", ".ext").
pub fn split_stem_and_ext(filename: &str) -> (&str, &str) {
    match filename.rfind('.') {
        Some(i) if i > 0 && i < filename.len() - 1 => (&filename[..i], &filename[i..]),
        _ => (filename, ""),
    }
}

pub fn tokenize(stem: &str) -> Vec<String> {
    stem.split(['.', '_', ' '])
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string())
        .collect()
}

/// Persian/Arabic-Indic digits → ASCII. Persian filenames often use ۰۱۲.
pub fn ascii_digits(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '۰'..'۹' => char::from_u32('0' as u32 + (c as u32 - '۰' as u32)).unwrap_or(c),
            '٠'..'٩' => char::from_u32('0' as u32 + (c as u32 - '٠' as u32)).unwrap_or(c),
            c => c,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_extension() {
        assert_eq!(split_stem_and_ext("movie.mkv"), ("movie", ".mkv"));
        assert_eq!(split_stem_and_ext("movie.en.srt"), ("movie.en", ".srt"));
        assert_eq!(split_stem_and_ext("noext"), ("noext", ""));
    }

    #[test]
    fn tokenizes_separators_keeps_hyphens() {
        assert_eq!(
            tokenize("Breaking.Bad.S01E01.1080p_WEB-DL.x265-GROUP"),
            vec!["Breaking", "Bad", "S01E01", "1080p", "WEB-DL", "x265-GROUP"]
        );
    }

    #[test]
    fn underscores_and_spaces_split() {
        assert_eq!(
            tokenize("The_Last_of_Us S02E03"),
            vec!["The", "Last", "of", "Us", "S02E03"]
        );
    }

    #[test]
    fn persian_digits_become_ascii() {
        assert_eq!(ascii_digits("فصل ۲ قسمت ۱"), "فصل 2 قسمت 1");
        assert_eq!(ascii_digits("٢٠٢٠"), "2020");
        assert_eq!(ascii_digits("plain 123"), "plain 123");
    }
}
