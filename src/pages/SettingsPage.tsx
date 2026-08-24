// ── SETTINGS ─────────────────────────────────────────────────

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Theme, useTheme } from "@/hooks/useTheme";
import { t } from "@/i18n";

const THEME_OPTIONS: { value: Theme; labelKey: Parameters<typeof t>[0] }[] = [
  { value: "light", labelKey: "settings.theme.light" },
  { value: "dark", labelKey: "settings.theme.dark" },
  { value: "system", labelKey: "settings.theme.system" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

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
        {/* ponytail: read-only until settings persistence lands; templates
            become editable inputs wired to the settings table. */}
        <div className="space-y-1.5">
          <Label htmlFor="tpl-movie" dir="ltr">
            {t("settings.template.movie")}
          </Label>
          <Input id="tpl-movie" dir="ltr" value="{title} {year}" readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-tv" dir="ltr">
            {t("settings.template.tv")}
          </Label>
          <Input
            id="tpl-tv"
            dir="ltr"
            value="{title} S{season:02} E{episode:02}"
            readOnly
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
