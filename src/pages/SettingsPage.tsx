// ── SETTINGS ─────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Theme, useTheme } from "@/hooks/useTheme";
import { t } from "@/i18n";
import { getSettings, setSetting } from "@/lib/tauri";

const THEME_OPTIONS: { value: Theme; labelKey: Parameters<typeof t>[0] }[] = [
  { value: "light", labelKey: "settings.theme.light" },
  { value: "dark", labelKey: "settings.theme.dark" },
  { value: "system", labelKey: "settings.theme.system" },
];

const DEFAULT_MOVIE_TPL = "{title} {year}";
const DEFAULT_TV_TPL = "{title} S{season:02} E{episode:02}";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  // Templates: loaded once, edited locally, saved on blur.
  const [movieTpl, setMovieTpl] = useState(DEFAULT_MOVIE_TPL);
  const [tvTpl, setTvTpl] = useState(DEFAULT_TV_TPL);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        setMovieTpl(s["templates.movie"] || DEFAULT_MOVIE_TPL);
        setTvTpl(s["templates.tv"] || DEFAULT_TV_TPL);
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, []);

  // ponytail: save-on-blur instead of live; a "saved" toast lands when
  // settings feedback becomes a priority.
  const saveTemplate = (key: string, value: string) =>
    void setSetting(key, value).catch(console.error);

  return (
    <div className="mx-auto h-full w-full max-w-xl space-y-4 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold">{t("nav.settings")}</h1>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold">{t("settings.appearance")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("settings.appearance.hint")}
          </p>
        </div>
        <fieldset className="flex gap-2 border-none p-0">
          <legend className="sr-only">{t("settings.appearance")}</legend>
          {THEME_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={
                theme === value
                  ? "flex flex-1 items-center justify-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
                  : "flex flex-1 items-center justify-center rounded-lg border bg-secondary/50 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              }
            >
              {t(labelKey)}
            </button>
          ))}
        </fieldset>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold">{t("settings.templates")}</h2>
          <p dir="ltr" className="text-start text-xs text-muted-foreground">
            {"{title} {year} {season} {episode} {resolution} {codec}"}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-movie" dir="ltr">
            {t("settings.template.movie")}
          </Label>
          <Input
            id="tpl-movie"
            dir="ltr"
            value={movieTpl}
            onChange={(e) => setMovieTpl(e.target.value)}
            onBlur={() => saveTemplate("templates.movie", movieTpl.trim())}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-tv" dir="ltr">
            {t("settings.template.tv")}
          </Label>
          <Input
            id="tpl-tv"
            dir="ltr"
            value={tvTpl}
            onChange={(e) => setTvTpl(e.target.value)}
            onBlur={() => saveTemplate("templates.tv", tvTpl.trim())}
          />
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-bold">{t("settings.folders")}</h2>
        <div
          dir="ltr"
          className="space-y-1 text-start text-xs text-muted-foreground"
        >
          <p>{t("settings.folders.movie")}</p>
          <p>{t("settings.folders.tv")}</p>
        </div>
      </section>
    </div>
  );
}
