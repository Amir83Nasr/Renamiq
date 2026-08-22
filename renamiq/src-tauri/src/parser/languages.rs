/// Subtitle language identifiers → ISO 639-1 code.
/// Add new languages by extending this table; no other code changes needed.
pub const LANGUAGES: &[(&str, &str)] = &[
    ("fa", "fa"),
    ("fas", "fa"),
    ("per", "fa"),
    ("persian", "fa"),
    ("فارسی", "fa"),
    ("en", "en"),
    ("eng", "en"),
    ("english", "en"),
    ("ar", "ar"),
    ("ara", "ar"),
    ("arabic", "ar"),
    ("tr", "tr"),
    ("tur", "tr"),
    ("turkish", "tr"),
];

/// Normalize a subtitle language token to its canonical code, if recognized.
pub fn canonical_language(token: Option<&str>) -> Option<&'static str> {
    match token {
        Some(raw) => {
            let lowered = raw.to_lowercase();
            LANGUAGES
                .iter()
                .find(|(id, _)| *id == lowered)
                .map(|(_, code)| *code)
        }
        None => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_aliases() {
        for alias in ["fa", "fas", "per", "persian", "فارسی"] {
            assert_eq!(canonical_language(Some(alias)), Some("fa"), "{alias}");
        }
        assert_eq!(canonical_language(Some("ENG")), Some("en"));
        assert_eq!(canonical_language(Some("Turkish")), Some("tr"));
    }

    #[test]
    fn unknown_returns_none() {
        assert_eq!(canonical_language(Some("klingon")), None);
        assert_eq!(canonical_language(None), None);
    }
}
