#[test]
#[ignore] // live network test; run with: cargo test -- --ignored
fn live_subkade_search_and_link() {
    let results = crate::media::subkade::search("mutiny 2026", 5).unwrap();
    assert!(!results.is_empty(), "expected at least one result");
    println!("{:?}", results);
    let zip = crate::media::subkade::find_zip_link(&results[0].url).unwrap();
    assert!(zip.contains("dl1.subkade.ir"));
}
