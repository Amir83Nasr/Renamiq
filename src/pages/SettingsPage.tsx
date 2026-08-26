// ── SETTINGS ─────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";
import { getSettings, pickFolder, setSetting } from "@/lib/tauri";
import { renderTemplatePreview, TEMPLATE_VARS } from "@/lib/templates";

const DEFAULT_MOVIE_TPL = "{title} {year}";
const DEFAULT_TV_TPL = "{title} S{season:02} E{episode:02}";

export default function SettingsPage() {
  // Templates: loaded once, edited locally, saved on blur.
  const [movieTpl, setMovieTpl] = useState(DEFAULT_MOVIE_TPL);
  const [tvTpl, setTvTpl] = useState(DEFAULT_TV_TPL);
  // Destination folders: loaded once, changed via folder picker.
  const [destMovie, setDestMovie] = useState("");
  const [destTv, setDestTv] = useState("");
  // Which template the var chips insert into.
  const lastFocused = useRef<"movie" | "tv">("movie");

  // Insert at cursor; empty template → replace wholesale.
  const insertVar = (v: (typeof TEMPLATE_VARS)[number]) => {
    const tag = `{${v}}`;
    const target = lastFocused.current;
    const input = document.getElementById(
      target === "movie" ? "tpl-movie" : "tpl-tv",
    ) as HTMLInputElement | null;
    if (!input) return;
    const start = input.selectionStart ?? null;
    const current = target === "movie" ? movieTpl : tvTpl;
    const next =
      start === null || current === ""
        ? current + tag
        : current.slice(0, start) + tag + current.slice(start);
    const caret = (start ?? next.length) + tag.length;
    if (target === "movie") setMovieTpl(next);
    else setTvTpl(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  };

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (!alive) return;
        setMovieTpl(s["templates.movie"] || DEFAULT_MOVIE_TPL);
        setTvTpl(s["templates.tv"] || DEFAULT_TV_TPL);
        setDestMovie(s["folders.movie"] || "");
        setDestTv(s["folders.tv"] || "");
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, []);

  // Live-save on each change; templates feed replan via the store.
  const saveTemplate = (key: string, value: string) =>
    void setSetting(key, value).catch(console.error);

  const chooseFolder = (key: "folders.movie" | "folders.tv") => {
    void pickFolder().then((path) => {
      if (!path) return;
      if (key === "folders.movie") setDestMovie(path);
      else setDestTv(path);
      void setSetting(key, path).catch(console.error);
    });
  };

  const clearFolder = (key: "folders.movie" | "folders.tv") => {
    if (key === "folders.movie") setDestMovie("");
    else setDestTv("");
    void setSetting(key, "").catch(console.error);
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-2">
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-2">
          <h2 className="text-sm font-bold">{t("settings.templates")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("settings.templates.hint")}
          </p>
          {/* Click a variable to insert it into the focused template. */}
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {TEMPLATE_VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
        <TemplateField
          id="tpl-movie"
          label={t("settings.template.movie")}
          value={movieTpl}
          sample={`${renderTemplatePreview(movieTpl || DEFAULT_MOVIE_TPL)}.mkv`}
          onChange={(v) => {
            setMovieTpl(v);
            saveTemplate("templates.movie", v.trim());
          }}
          onFocus={() => (lastFocused.current = "movie")}
        />
        <TemplateField
          id="tpl-tv"
          label={t("settings.template.tv")}
          value={tvTpl}
          sample={`${renderTemplatePreview(tvTpl || DEFAULT_TV_TPL)}.mkv`}
          onChange={(v) => {
            setTvTpl(v);
            saveTemplate("templates.tv", v.trim());
          }}
          onFocus={() => (lastFocused.current = "tv")}
        />
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold">{t("settings.folders")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("settings.folders.hint")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dest-movie">{t("settings.folders.movieLabel")}</Label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <PathInput id="dest-movie" value={destMovie} />
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => chooseFolder("folders.movie")}
            >
              {t("settings.folders.pick")}
            </Button>
            {destMovie && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => clearFolder("folders.movie")}
              >
                {t("settings.folders.clear")}
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dest-tv">{t("settings.folders.tvLabel")}</Label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <PathInput id="dest-tv" value={destTv} />
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => chooseFolder("folders.tv")}
            >
              {t("settings.folders.pick")}
            </Button>
            {destTv && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => clearFolder("folders.tv")}
              >
                {t("settings.folders.clear")}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Read-only folder path; full path on hover when truncated. */
function PathInput({ id, value }: { id: string; value: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Input id={id} dir="ltr" readOnly value={value} className="min-w-0" />
        }
      />
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}

/** LTR template input with a live output preview underneath. */
function TemplateField({
  id,
  label,
  value,
  sample,
  onChange,
  onFocus,
}: {
  id: string;
  label: string;
  value: string;
  sample: string;
  onChange: (v: string) => void;
  onFocus: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} dir="ltr">
        {label}
      </Label>
      <Input
        id={id}
        dir="ltr"
        value={value}
        placeholder={t("settings.template.empty")}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      <p dir="ltr" className="text-start text-xs text-muted-foreground">
        {t("settings.template.preview")}
      </p>
      <p
        dir="ltr"
        className="truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs font-semibold"
      >
        {sample}
      </p>
    </div>
  );
}
