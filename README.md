# Renamiq

**Rename smarter. Organize better.**

Renamiq is a local-first desktop app that turns messy download folders into clean
movie and TV libraries: it scans a folder, parses movie/show names out of noisy
release filenames, previews a rename/organize plan, and applies it safely —
subtitles included.

## Features (MVP)

- Recursive folder scan for video + subtitle files
- Movie / TV detection with year, season, episode, resolution, codec, group extraction
- Release-noise removal (`1080p WEB-DL x265-GROUP` → gone; title words preserved)
- Configurable naming templates (`{title} {year}`, `{title} S{season:02} E{episode:02}`)
- Folder organization: `Movies/<Title>/`, `TV Shows/<Title>/Season NN/`
- Subtitle matching by normalized stem similarity + language detection (fa/en/ar/tr, extensible)
- Rename preview with per-file opt-out
- Collision detection — existing files are never overwritten silently
- SQLite operation history with undo of the last rename batch
- Cross-platform paths (macOS/Windows/Linux), Unicode/Persian filenames supported

## Stack

Tauri 2 · React 19 · TypeScript · Vite · Tailwind CSS 4 · Rust · SQLite (rusqlite, bundled)

## Development

```sh
pnpm install
pnpm tauri dev      # run the desktop app in dev mode
pnpm build          # typecheck + frontend bundle
cargo test          # in src-tauri/: parser/rename/scanner integration tests
```

## Architecture

```
src/                     React frontend
  components/ui/         shadcn-style primitives
  pages/                 Library, Organize, Subtitles, Activity, Settings
  stores/                zustand app state
  lib/tauri.ts           typed command wrappers (UI never calls invoke raw)
  i18n/                  centralized strings (RTL-ready)
src-tauri/src/           Rust core
  parser/                filename parsing: tokens, noise table, languages
  scanner/               recursive media/subtitle discovery
  rename/                templates, plan builder, safe executor
  database/              migrations + connection
  commands/              thin Tauri command layer
  core/error.rs          user-facing error mapping
```

Safety rules baked into the engine: preview before apply, collisions flagged at
plan time, no silent overwrite, undo journal written on every executed batch.
