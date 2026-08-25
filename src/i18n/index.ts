/**
 * Centralized i18n. App language is Persian (فارسی) with RTL layout.
 * Add a locale by adding an entry to `dictionaries` and flipping `locale`.
 */

export const dictionaries = {
  fa: {
    "app.title": "رنامیق",
    "app.tagline": "تغییرنام هوشمند، سازمان‌دهی تمیز",
    "nav.workspace": "فضای کاری",
    "nav.activity": "فعالیت",
    "nav.settings": "تنظیمات",

    "workspace.drop.title": "فایل‌ها را اینجا رها کنید",
    "workspace.drop.or": "یا انتخاب کنید",
    "workspace.pickFiles": "انتخاب فایل",
    "workspace.pickFolder": "انتخاب پوشه",
    "workspace.dropToScan": "رها کنید تا اسکن شود",
    "workspace.scanning": "در حال اسکن…",
    "workspace.fileCount": "{count} فایل",
    "workspace.organizeIntoFolders": "سازمان‌دهی در پوشه‌ها",
    "workspace.rescan": "اسکن دوباره",
    "workspace.clear": "پاک کردن",

    "status.ready": "آماده",
    "status.needsreview": "نیازمند بازبینی",
    "status.error": "خطا",
    "status.conflict": "تعارض",

    "warn.notype": "نوع فایل تشخیص داده نشد",
    "warn.notitle": "عنوان تشخیص داده نشد",
    "warn.noyear": "سال پیدا نشد",
    "warn.nosxe": "فصل یا قسمت پیدا نشد",
    "warn.unsure": "عنوان با اطمینان کم تشخیص داده شد",
    "warn.empty": "نام خالی است",
    "warn.exists": "فایلی با همین نام از قبل وجود دارد",
    "warn.duplicate": "فایل دیگری به همین مقصد اشاره می‌کند",
    "warn.replace": "جایگزین می‌شود",

    "editor.title": "ویرایش",
    "editor.field.title": "عنوان",
    "editor.field.type": "نوع",
    "editor.type.movie": "فیلم",
    "editor.type.tv": "سریال",
    "editor.type.unknown": "نامشخص",
    "editor.field.year": "سال",
    "editor.field.season": "فصل",
    "editor.field.episode": "قسمت",
    "editor.customName": "نام دلخواه",
    "editor.customNameHint": "نام نهایی را مستقیم وارد کنید",
    "editor.exclude": "کنار گذاشتن",
    "editor.preview": "پیش‌نمایش",

    "subtitle.language": "زبان زیرنویس",
    "subtitle.attachedTo": "پیوست به ویدیو",
    "subtitle.none": "بدون زبان",
    "warn.orphanSubtitle": "ویدیوی متناظر در لیست نیست؛ جابجا نمی‌شود",

    "subkade.title": "دانلود زیرنویس از سابکده",
    "subkade.placeholder": "نام فیلم یا سریال…",
    "subkade.search": "جستجو",
    "subkade.empty": "نتیجه‌ای پیدا نشد",
    "subkade.done": "زیرنویس دانلود شد:\n{files}",
    "subkade.download": "دانلود زیرنویس",

    "confirm.title": "تغییرنام {count} فایل؟",
    "confirm.description":
      "با تأیید، نام فایل‌ها روی دیسک تغییر می‌کند. این عمل قابل بازگشت است.",
    "confirm.ready": "آماده",
    "confirm.warnings": "هشدار",
    "confirm.errors": "خطا",
    "confirm.conflicts": "تعارض",
    "confirm.cancel": "انصراف",
    "confirm.rename": "تغییرنام فایل‌ها",
    "confirm.hasConflicts":
      "{count} تعارض حل‌نشده وجود دارد؛ فقط موارد آماده اجرا می‌شوند.",

    "result.done": "{ok} فایل تغییرنام یافت",
    "result.failed": "{failed} مورد ناموفق بود",
    "result.undo": "واگرد",
    "result.undone": "همه تغییرات واگرد شد",
    "result.close": "بستن",

    "resolution.exists": "تعارض:",
    "resolution.skip": "رد شدن",
    "resolution.replace": "جایگزینی",
    "resolution.suffix": "افزودن پسوند",

    "activity.title": "فعالیت",
    "activity.empty.title": "فعالیتی نیست",
    "activity.empty.hint":
      "تغییرنام‌های انجام‌شده همراه با قابلیت بازگشت اینجا نمایش داده می‌شوند.",
    "activity.undo": "بازگردانی آخرین",
    "activity.undoing": "در حال بازگردانی…",
    "activity.refresh": "به‌روزرسانی",
    "activity.undoable": "قابل بازگشت",

    "settings.appearance": "ظاهر",
    "settings.appearance.hint": "روشن، تاریک یا هماهنگ با سیستم.",
    "settings.theme.light": "روشن",
    "settings.theme.dark": "تاریک",
    "settings.theme.system": "سیستم",
    "settings.templates": "الگوهای نام‌گذاری",
    "settings.templates.hint":
      "متغیرها: {title} {year} {season} {episode} {resolution} {codec}",
    "settings.template.movie": "فیلم",
    "settings.template.tv": "قسمت سریال",
    "settings.folders": "ساختار پوشه‌ها",
    "settings.folders.movie": "Movies/<عنوان>/<فایل>",
    "settings.folders.tv": "TV Shows/<عنوان>/Season NN/<فایل>",
    "settings.language": "زبان",

    "error.generic": "مشکلی پیش آمد. دوباره تلاش کنید.",
  },
} as const;

export type Locale = keyof typeof dictionaries;
export type MessageKey = keyof (typeof dictionaries)["fa"];

let locale: Locale = "fa";

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
