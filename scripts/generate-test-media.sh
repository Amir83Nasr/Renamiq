#!/usr/bin/env bash
# ─── Test Media Generator ─────────────────────────────────────────────────────
# Generates diverse dummy media files and subtitle files for testing Renamiq.

TEST_DIR="test_media"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

# TV Shows with complex naming, various qualities, codecs, and release groups
TV_SHOWS=(
    "Breaking Bad/Season 01/Breaking.Bad.S01E01.1080p.WEB-DL.x265-ANON.mkv"
    "Breaking Bad/Season 01/Breaking.Bad.S01E02.720p.HDTV.x264-GROUP.mkv"
    "Breaking Bad/Season 02/Breaking.Bad.S02E05.2160p.UHD.BluRay.x265-TRiM.mkv"
    "Game of Thrones/Season 08/Game.of.Thrones.S08E06.The.Iron.Throne.1080p.WEB-DL.DD5.1.H.264-NTb.mkv"
    "Stranger Things/Season 03/Stranger.Things.S03E01.Chapter.One.Suze.Do.You.Copy.2160p.NF.WEB-DL.DDP5.1.Atmos.HDR.H.265-TEPES.mkv"
    "Succession/Season 01/Succession.S01E01.Pilot.1080p.AMZN.WEB-DL.DDP2.0.H.264-NTb.mkv"
    "The Office (US)/Season 02/The.Office.S02E04.The.Fire.DVDRip.XviD-OSiRIS.avi"
    "Better Call Saul/Season 01/Better.Call.Saul.S01E01.Uno.1080p.WEBRip.DD5.1.AAC2.0.H.264-RTN.mkv"
)

for show in "${TV_SHOWS[@]}"; do
    dir="$TEST_DIR/TV Shows/$(dirname "$show")"
    mkdir -p "$dir"
    touch "$TEST_DIR/TV Shows/$show"
done

# Movies with various years, resolutions, editions, and formats
MOVIES=(
    "Obsession/Obsession.2026.1080p.WEB-DL.x265-GROUP.mkv"
    "Dune Part Two/Dune.Part.Two.2024.IMAX.2160p.UHD.BluRay.x265.TrueHD.7.1.Atmos-SURiCAT.mkv"
    "Interstellar/Interstellar.2014.REMASTERED.1080p.BluRay.x264-SPARKS.mp4"
    "Parasite/Parasite.2019.KOREAN.1080p.BluRay.H264.AAC-VXT.mkv"
    "Spider-Man Across the Spider-Verse/Spider-Man.Across.the.Spider-Verse.2023.2160p.MA.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX.mkv"
    "The Godfather/The.Godfather.1972.Restored.1080p.BluRay.AC3.5.1.x264-EVOLVE.mkv"
    "Everything Everywhere All at Once/Everything.Everywhere.All.at.Once.2022.1080p.AMZN.WEB-DL.DDP5.1.H.264-APEX.mkv"
    "Spirited Away/Spirited.Away.2001.JAPANESE.1080p.BluRay.x264.DTS-HD.MA.5.1-NOGRP.mkv"
)

for movie in "${MOVIES[@]}"; do
    dir="$TEST_DIR/Movies/$(dirname "$movie")"
    mkdir -p "$dir"
    touch "$TEST_DIR/Movies/$movie"
done

# Subtitles samples
touch "$TEST_DIR/TV Shows/Breaking Bad/Season 01/Breaking.Bad.S01E01.1080p.WEB-DL.x265-ANON.fa.srt"
touch "$TEST_DIR/TV Shows/Breaking Bad/Season 01/Breaking.Bad.S01E01.1080p.WEB-DL.x265-ANON.en.srt"
touch "$TEST_DIR/Movies/Dune Part Two/Dune.Part.Two.2024.IMAX.2160p.UHD.BluRay.x265.TrueHD.7.1.Atmos-SURiCAT.fa.srt"

echo "✓ Expanded diverse test media files created in $TEST_DIR/"
