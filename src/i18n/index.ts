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
    "history.items": "{count} files",
    "history.undo": "Undo",
    "history.undoDone": "Operation undone",

    "settings.templates": "Naming templates",
    "settings.templates.hint": "Click a variable to insert it at the cursor.",
    "settings.template.movie": "Movie",
    "settings.template.tv": "TV episode",
    "settings.template.preview": "Preview",
    "settings.template.empty": "(empty — default is used)",
    "settings.folders": "Destination folders",
    "settings.folders.hint":
      "Where organized movies and series are moved. Leave empty to use the scanned folder.",
    "settings.folders.movieLabel": "Movies folder",
    "settings.folders.tvLabel": "Series folder",
    "settings.folders.pick": "Choose",
    "settings.folders.clear": "Clear",
    "settings.folders.default": "Default: inside the scanned folder",
    "settings.language": "Language",

    // Model configuration / settings
    "settings.model": "AI Model Configuration",
    "settings.model.hint":
      "Configure output model provider, name, and advanced generation settings.",
    "settings.model.provider": "Provider",
    "settings.model.name": "Model Name",
    "settings.model.temperature": "Temperature",
    "settings.model.maxTokens": "Max Output Tokens",
    "settings.model.apiKey": "API Key",
    "settings.model.saved": "Model settings saved successfully",

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
