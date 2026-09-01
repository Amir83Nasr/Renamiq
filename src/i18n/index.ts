/**
 * Centralized i18n. App language is English with LTR layout.
 * Add a locale by adding an entry to `dictionaries` and flipping `locale`.
 */

export const dictionaries = {
  en: {
    "app.title": "Renamiq",
    "app.tagline": "Smart rename, clean organization",
    "nav.workspace": "Workspace",
    "nav.subkade": "Subtitles",
    "nav.embed": "Embed Subtitle",
    "nav.remove": "Remove Subtitle",
    "nav.posters": "Posters",
    "nav.history": "History",
    "nav.settings": "Settings",
    "nav.group.main": "Library",
    "nav.group.downloads": "Downloads",
    "nav.group.subtitles": "Subtitles",
    "nav.group.media": "Media",
    "nav.group.system": "System",

    "workspace.drop.title": "Drop files here",
    "workspace.drop.or": "or browse",
    "workspace.pickFiles": "Browse files",
    "workspace.pickFolder": "Browse folder",
    "workspace.dropToScan": "Drop to scan",
    "workspace.scanning": "Scanning…",
    "workspace.fileCount": "{count} files",
    "workspace.organizeIntoFolders": "Organize into folders",
    "workspace.rescan": "Rescan",
    "workspace.clear": "Clear",

    "status.ready": "Ready",
    "status.needsreview": "Needs review",
    "status.error": "Error",
    "status.conflict": "Conflict",

    "warn.notype": "File type not detected",
    "warn.notitle": "Title not detected",
    "warn.noyear": "Year not found",
    "warn.nosxe": "Season or episode not found",
    "warn.unsure": "Title detected with low confidence",
    "warn.empty": "Name is empty",
    "warn.exists": "A file with this name already exists",
    "warn.duplicate": "Another file points to the same destination",
    "warn.replace": "Will be replaced",

    "editor.title": "Edit",
    "editor.field.title": "Title",
    "editor.field.type": "Type",
    "editor.type.movie": "Movie",
    "editor.type.tv": "TV Show",
    "editor.type.unknown": "Unknown",
    "editor.field.year": "Year",
    "editor.field.season": "Season",
    "editor.field.episode": "Episode",
    "editor.customName": "Custom name",
    "editor.customNameHint": "Enter the final name directly",
    "editor.exclude": "Exclude",
    "editor.preview": "Preview",

    "subtitle.language": "Subtitle language",
    "subtitle.attachedTo": "Attached to video",
    "subtitle.none": "No language",
    "warn.orphanSubtitle": "Matching video is not in the list; won't be moved",

    "subkade.title": "Download subtitles from Subkade",
    "subkade.placeholder": "Movie or show name…",
    "subkade.search": "Search",
    "subkade.empty": "No results found",
    "subkade.notFound": "Couldn't find anything for that name",
    "subkade.hint": "Search a movie or show name to find Persian subtitles.",
    "subkade.pickFolderFirst": "Pick a destination folder first",
    "subkade.done": "Subtitle downloaded:\n{files}",
    "subkade.zipSize": "Archive size: {size}",
    "subkade.download": "Download subtitle",
    "subkade.downloading": "Downloading… {percent}%",
    "subkade.downloadingUnknown": "Downloading…",
    "subkade.logTitle": "Downloaded {count} file(s)",
    "search.timeout": "Search timed out. Please try again.",
    "subkade.logClear": "Clear history",

    "embed.pickVideo": "Choose video",
    "embed.pickSubtitle": "Choose subtitle",
    "embed.noneSelected": "Nothing selected yet",
    "embed.run": "Embed",
    "embed.hint":
      "Pick a video and a subtitle file — the subtitle is added as a selectable soft track (original video is replaced in place). Requires ffmpeg.",
    "embed.done": "Subtitle embedded:\n{file}",
    "embed.lang.per": "Persian",
    "embed.lang.eng": "English",
    "embed.lang.ara": "Arabic",
    "embed.lang.none": "No language",

    "remove.title": "Remove Embedded Subtitles",
    "remove.pickVideo": "Choose video",
    "remove.noneSelected": "Nothing selected yet",
    "remove.run": "Remove",
    "remove.hint":
      "Select a video — removes ALL embedded subtitle tracks. Original video replaced. Requires ffmpeg.",
    "remove.done": "Subtitles removed:\n{file}",

    "posters.placeholder": "Movie or show name…",
    "posters.search": "Search",
    "posters.hint": "Search TMDB for the official poster of a movie or show.",
    "posters.notFound": "Couldn't find anything for that name",
    "posters.noPoster": "No poster",
    "posters.pickFolderFirst": "Pick a destination folder first",
    "posters.done": "Poster saved:\n{file}",
    "posters.type.movie": "Movie",
    "posters.type.tv": "TV",
    "posters.downloading": "Downloading… {percent}%",
    "posters.downloadingUnknown": "Downloading…",

    "confirm.title": "Rename {count} files?",
    "confirm.description":
      "Confirming renames the files on disk. This action is reversible.",
    "confirm.preview": "Preview",
    "confirm.ready": "Ready",
    "confirm.warnings": "Warnings",
    "confirm.errors": "Errors",
    "confirm.conflicts": "Conflicts",
    "confirm.cancel": "Cancel",
    "common.reset": "Reset",
    "confirm.rename": "Rename files",
    "confirm.hasConflicts":
      "{count} unresolved conflicts; only ready items will run.",

    "result.done": "{ok} files renamed",
    "result.failed": "{failed} failed",
    "result.undo": "Undo",
    "result.undone": "All changes undone",
    "result.close": "Close",

    "resolution.exists": "Conflict:",
    "resolution.skip": "Skip",
    "resolution.replace": "Replace",
    "resolution.suffix": "Add suffix",
    "resolution.applyAll": "Apply to all conflicts",

    "history.empty": "No rename operations yet",
    "history.emptyHint":
      "Renames you run in the workspace show up here, newest first.",
    "history.items": "{count} files",
    "history.count": "{count} operations",
    "history.undo": "Undo",
    "history.undoDone": "Operation undone",
    "history.loading": "Loading history…",
    "history.refresh": "Refresh",
    "history.retry": "Try again",
    "history.kind.rename": "Rename",
    "history.status.completed": "Completed",
    "history.status.partial": "Partly done",
    "history.status.failed": "Failed",
    "history.status.undone": "Undone",

    "settings.about.version": "Version 0.2.0",
    "settings.about.description":
      "Intelligent media renaming and organization. Detects titles, years, seasons and episodes from messy filenames and produces clean, organized output.",

    "settings.templates": "Naming templates",
    "settings.templates.hint":
      "Customize how renamed files are formatted. Click a variable to insert it.",
    "settings.templates.variables": "Available variables",
    "settings.templates.var.title": "Media title",
    "settings.templates.var.year": "Release year",
    "settings.templates.var.season": "Season number",
    "settings.templates.var.episode": "Episode number",
    "settings.templates.var.resolution": "Video resolution (e.g. 1080p)",
    "settings.templates.var.codec": "Video codec (e.g. x265)",
    "settings.templates.var.group": "Release group",
    "settings.templates.var.audio": "Audio codec (e.g. DDP5.1)",
    "settings.templates.var.edition": "Edition tag (e.g. Extended)",
    "settings.template.movie": "Movie",
    "settings.template.tv": "TV episode",
    "settings.template.preview": "Example output",
    "settings.template.reset": "Reset",
    "settings.template.empty": "(empty — default is used)",

    "settings.folders": "Destination folders",
    "settings.folders.hint":
      "Where organized movies and series are moved after renaming.",
    "settings.folders.movieLabel": "Movies folder",
    "settings.folders.movieHint":
      "Movies will be placed inside this directory.",
    "settings.folders.tvLabel": "Series folder",
    "settings.folders.tvHint":
      "Series will be organized into Season sub-folders here.",
    "settings.folders.pick": "Choose",
    "settings.folders.clear": "Clear",
    "settings.folders.default":
      "When empty, files stay inside the folder you scanned.",
    "settings.language": "Language",

    "error.generic": "Something went wrong. Please try again.",
  },
} as const;

export type Locale = keyof typeof dictionaries;
export type MessageKey = keyof (typeof dictionaries)["en"];

let locale: Locale = "en";

export function setLocale(next: Locale) {
  locale = next;
}

export function getLocale(): Locale {
  return locale;
}

export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let text: string = dictionaries[locale][key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
