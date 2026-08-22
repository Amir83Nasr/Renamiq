#!/usr/bin/env bash
# ─── Test Media Generator ─────────────────────────────────────────────────────
# Generates dummy media files for testing Renamiq functionality.

TEST_DIR="test_media"
mkdir -p "$TEST_DIR"

# TV Show structure
mkdir -p "$TEST_DIR/TV Shows/Breaking Bad/Season 01"
touch "$TEST_DIR/TV Shows/Breaking Bad/Season 01/Breaking.Bad.S01E01.1080p.WEB-DL.x265-GROUP.mkv"
touch "$TEST_DIR/TV Shows/Breaking Bad/Season 01/Breaking.Bad.S01E02.1080p.WEB-DL.x265-GROUP.mkv"

# Movie structure
mkdir -p "$TEST_DIR/Movies/Obsession"
touch "$TEST_DIR/Movies/Obsession/Obsession.2026.1080p.WEB-DL.x265-GROUP.mkv"

echo "✓ Dummy media files created in $TEST_DIR/"
