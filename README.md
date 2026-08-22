# Renamiq

**Rename smarter. Organize better.**

Renamiq is a smart, cross-platform desktop application for organizing movie and TV show libraries.

It automatically analyzes messy media filenames, detects titles, years, seasons, episodes, and subtitles, then renames and organizes files into a clean and consistent structure.

## ✨ Features

* 🎬 Movie & TV show detection
* 🧠 Intelligent filename parsing
* ✏️ Clean and consistent renaming
* 📁 Automatic folder organization
* 🎞️ Season & episode detection
* 📝 Subtitle matching and management
* 🔤 Subtitle language detection
* 🎥 Media metadata analysis
* 👀 Rename preview before applying changes
* ↩️ Operation history and undo support
* ⚙️ Configurable naming templates

## 🛠️ Tech Stack

* **Tauri 2**
* **React + TypeScript**
* **Vite**
* **Tailwind CSS**
* **shadcn/ui**
* **Rust**
* **SQLite**
* **FFmpeg / FFprobe**
* **MKVToolNix**

## 📂 Example

Before:

```text
Breaking.Bad.S01E01.1080p.WEB-DL.x265-GROUP.mkv
```

After:

```text
Breaking Bad/
└── Season 01/
    └── Breaking Bad S01 E01.mkv
```

Movie:

```text
Obsession.2026.1080p.WEB-DL.x265-GROUP.mkv
```

becomes:

```text
Obsession/
└── Obsession 2026.mkv
```

## 🚧 Status

Renamiq is currently under active development.

The initial focus is on building a reliable media parser, rename engine, folder organizer, and subtitle management system.

## 📄 License

License will be added before the first stable release.
