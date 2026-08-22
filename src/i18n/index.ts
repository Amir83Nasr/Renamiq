/**
 * Minimal centralized i18n scaffold. English now; Persian/RTL later.
 * Add a locale by adding an entry to `dictionaries` and flipping `locale`.
 */

export const dictionaries = {
  en: {
    "app.title": "Renamiq",
    "app.tagline": "Rename smarter. Organize better.",
    "nav.library": "Library",
    "nav.organize": "Organize",
    "nav.subtitles": "Subtitles",
    "nav.activity": "Activity",
    "nav.settings": "Settings",
    "library.empty.title": "No library yet",
    "library.empty.hint": "Choose a folder to scan for movies and TV shows.",
    "library.pickFolder": "Pick Folder",
    "library.scan": "Scan",
    "library.scanning": "Scanning…",
    "library.fileCount": "{count} files",
    "organize.title": "Rename Preview",
    "organize.apply": "Apply Changes",
    "organize.cancel": "Cancel",
    "organize.selected": "{count} selected",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.system": "System",
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

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let text: string = dictionaries[locale][key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
