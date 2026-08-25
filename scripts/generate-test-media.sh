#!/usr/bin/env bash
# ─── Test Media Generator ─────────────────────────────────────────────────────
# Generates diverse dummy media files and subtitle files for testing Renamiq.

TEST_DIR="test_media"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

# ─── Series ───────────────────────────────────────────────────────────────────
# All series titled "Series"; varied seasons, episodes, qualities, codecs,
# release groups, sources and naming quirks.
SERIES=(
    "Series.S01E01.1080p.WEB-DL.x265-ANON.mkv"
    "Series.S01E02.720p.HDTV.x264-GROUP.mkv"
    "Series.S01E03.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.mkv"
    "Series.S01E04.The.Fire.DVDRip.XviD-OSiRIS.avi"
    "Series.S01E05.Uno.1080p.WEBRip.DD5.1.AAC2.0.H.264-RTN.mp4"
    "Series.S01E06.480p.WEBRip.x264-RARBG.mkv"
    "Series.S02E01.2160p.UHD.BluRay.x265-TRiM.mkv"
    "Series.S02E02.Pilot.1080p.WEB-DL.DDP2.0.H.264.mkv"
    "Series.S02E03.Chapter.One.2160p.NF.WEB-DL.DDP5.1.Atmos.HDR.H.265-TEPES.mkv"
    "Series.S02E04.1080p.BluRay.x264-GECKOS.mkv"
    "Series.S02E05.720p.WEB-DL.AAC2.0.H.264-KiNGS.mp4"
    "Series.S03E01E02.1080p.WEB-DL.DDP5.1.H.264-GROUP.mkv"
    "Series.S03E03-E04.2160p.WEB-DL.Atmos.HDR10Plus.H.265-FLUX.mkv"
    "Series.S03E05.PROPER.1080p.WEB.h264-GROUP.mkv"
    "Series.S03E06.REPACK.720p.XviD-GROUP.avi"
    "Series.S00E01.Making.of.Series.1080p.WEB-DL.x264-GROUP.mkv"
)

for ep in "${SERIES[@]}"; do
    season=$(echo "$ep" | grep -oE 'S[0-9]{2}' | head -1)
    case "$season" in
        S01) sdir="Season 01" ;;
        S02) sdir="Season 02" ;;
        S03) sdir="Season 03" ;;
        S00) sdir="Specials" ;;
        *)   sdir="Season 05" ;;
    esac
    dir="$TEST_DIR/Series/Series/$sdir"
    mkdir -p "$dir"
    touch "$dir/$ep"
done

# Subtitle sidecars for series
touch "$TEST_DIR/Series/Series/Season 01/Series.S01E01.1080p.WEB-DL.x265-ANON.fa.srt"
touch "$TEST_DIR/Series/Series/Season 01/Series.S01E01.1080p.WEB-DL.x265-ANON.en.srt"
touch "$TEST_DIR/Series/Series/Season 01/Series.S01E03.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTb.ar.srt"
touch "$TEST_DIR/Series/Series/Season 02/Series.S02E03.Chapter.One.2160p.NF.WEB-DL.DDP5.1.Atmos.HDR.H.265-TEPES.fa.srt"

# Loose episode without season folder
mkdir -p "$TEST_DIR/Downloads"
touch "$TEST_DIR/Downloads/Series.S05E09.1080p.WEB-DL.x264-GROUP.mkv"
touch "$TEST_DIR/Downloads/Series.S05E09.1080p.WEB-DL.x264-GROUP.fa.srt"
touch "$TEST_DIR/Downloads/Obsession.2026.720p.HDCAM.XviD-GROUP.avi"

# ─── Movies ───────────────────────────────────────────────────────────────────
MOVIES=(
    "Obsession/Obsession.2026.1080p.WEB-DL.x265-GROUP.mkv"
    "Movie/Movie.2024.2160p.UHD.BluRay.x265.HDR-GROUP.mkv"
    "Dune Part Two/Dune.Part.Two.2024.IMAX.2160p.UHD.BluRay.x265.TrueHD.7.1.Atmos-SURiCAT.mkv"
    "Interstellar/Interstellar.2014.REMASTERED.1080p.BluRay.x264-SPARKS.mp4"
    "Parasite/Parasite.2019.KOREAN.1080p.BluRay.H264.AAC-VXT.mkv"
    "Spider-Man Across the Spider-Verse/Spider-Man.Across.the.Spider-Verse.2023.2160p.MA.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX.mkv"
    "The Godfather/The.Godfather.1972.Restored.1080p.BluRay.AC3.5.1.x264-EVOLVE.mkv"
    "Everything Everywhere All at Once/Everything.Everywhere.All.at.Once.2022.1080p.AMZN.WEB-DL.DDP5.1.H.264-APEX.mkv"
    "Spirited Away/Spirited.Away.2001.JAPANESE.1080p.BluRay.x264.DTS-HD.MA.5.1-NOGRP.mkv"
    "Mad Max Fury Road/Mad.Max.Fury.Road.2015.Black.and.Chrome.1080p.BluRay.x264-GROUP.mkv"
    "Blade Runner 2049/Blade.Runner.2049.2017.2160p.HDR.HEVC.GEN8-DDR.mkv"
    "Whiplash/Whiplash.2014.LIMITED.720p.BluRay.x264-GECKOS.mp4"
    "Oppenheimer/Oppenheimer.2023.1080p.WEB-DL.DDP5.1.Atmos.H.264-GROUP.mkv"
    "Barbie/Barbie.2023.1080p.HDRip.XviD.AC3-EVO.avi"
    "Your Name/Your.Name.2016.JAPANESE.1080p.BluRay.x264.DTS-GRP.mkv"
    "The Dark Knight/The.Dark.Knight.2008.4K.REMASTER.2160p.UHD.BluRay.HEVC.Atmos-GROUP.mkv"
    "Coco/Coco.2017.SPANISH.1080p.WEB-DL.DD5.1.H264-GROUP.mkv"
    "Old Movie/Old.Movie.1954.DVDRip.XViD-GROUP.avi"
    "No Year Movie/No.Year.Movie.1080p.WEB-DL.x264-GROUP.mkv"
)

for movie in "${MOVIES[@]}"; do
    dir="$TEST_DIR/Movies/$(dirname "$movie")"
    mkdir -p "$dir"
    touch "$TEST_DIR/Movies/$movie"
done

# Subtitle sidecars for movies
touch "$TEST_DIR/Movies/Dune Part Two/Dune.Part.Two.2024.IMAX.2160p.UHD.BluRay.x265.TrueHD.7.1.Atmos-SURiCAT.fa.srt"
touch "$TEST_DIR/Movies/Parasite/Parasite.2019.KOREAN.1080p.BluRay.H264.AAC-VXT.en.srt"
touch "$TEST_DIR/Movies/Your Name/Your.Name.2016.JAPANESE.1080p.BluRay.x264.DTS-GRP.fa.srt"

# Extra junk files that a scanner should skip
touch "$TEST_DIR/Movies/Interstellar/covers.jpg"
touch "$TEST_DIR/Series/Series/Season 01/poster.png"
touch "$TEST_DIR/Downloads/notes.txt"

echo "✓ Test media created in $TEST_DIR/"
