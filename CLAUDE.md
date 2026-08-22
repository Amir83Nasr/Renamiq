# Project Brief

Renamiq — cross-platform desktop app for intelligently renaming and organizing downloaded movies and TV shows.

Takes messy media files like:

```text
Breaking.Bad.S01E01.1080p.WEB-DL.x265-GROUP.mkv
Obsession.2026.1080p.WEB-DL.x265-GROUP.mkv
```

Extracts title, year, season, episode, subtitle language; strips release/download metadata; produces clean names:

```text
Breaking Bad S01 E01.mkv
Obsession 2026.mkv
```

Also organizes files into a clean library structure:

```text
TV Shows/
└── Breaking Bad/
    └── Season 01/
        └── Breaking Bad S01 E01.mkv

Movies/
└── Obsession/
    └── Obsession 2026.mkv
```

Also detects/matches external subtitle files, identifies their languages, and eventually supports embedding/muxing subtitles into media files.

Core philosophy: **Scan → Understand → Preview → Rename → Organize → Manage Subtitles**

Priorities: accuracy, safety, configurability, clean modern desktop experience.

Name comes from **Rename + IQ** — intelligent media renaming and organization.

# Project Instructions

- Always use `pnpm` instead of `npm` for installing dependencies and running scripts.
- Never make a, b, or c text files.
- App is Persian (فارسی) and RTL: all UI text in Persian, `dir="rtl"` on `<html>` (already set in index.html), font IRANYekanX (already wired in index.css). New components must follow RTL/Persian — no LTR assumptions, no English UI strings.
- Section separators in code files use this exact style (content padded so every line is the same total width of 60 chars):
  `── NAME ─────…─` where dashes fill to width 60. Wrap in `/* */` in CSS, `//` in JS/TSX.
