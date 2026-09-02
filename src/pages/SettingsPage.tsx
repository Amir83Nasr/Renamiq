// ── SETTINGS ─────────────────────────────────────────────────

import { AppWindowMac, FolderInput, RotateCcw, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
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

// ── DEFAULTS ─────────────────────────────────────────────────
const DEFAULT_MOVIE_TPL = "{title} {year}";
const DEFAULT_TV_TPL = "{title} S{season:02} E{episode:02}";

// ── HELPER ───────────────────────────────────────────────────
const saveSetting = (key: string, value: string) =>
  void setSetting(key, value).catch(console.error);

export default function SettingsPage() {
  // ── Templates ─────────────────────────────────────────────
  const [movieTpl, setMovieTpl] = useState(DEFAULT_MOVIE_TPL);
  const [tvTpl, setTvTpl] = useState(DEFAULT_TV_TPL);
  const lastFocused = useRef<"movie" | "tv">("movie");

  // ── Destination folders ───────────────────────────────────
  const [destMovie, setDestMovie] = useState("");
  const [destTv, setDestTv] = useState("");

  // ── Load saved settings ───────────────────────────────────
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

  // ── Template variable insertion ────────────────────────────
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

  // ── Template reset ────────────────────────────────────────
  const resetMovieTemplate = () => {
    setMovieTpl(DEFAULT_MOVIE_TPL);
    saveSetting("templates.movie", DEFAULT_MOVIE_TPL);
  };

  const resetTvTemplate = () => {
    setTvTpl(DEFAULT_TV_TPL);
    saveSetting("templates.tv", DEFAULT_TV_TPL);
  };

  const movieTemplateModified = movieTpl !== DEFAULT_MOVIE_TPL;
  const tvTemplateModified = tvTpl !== DEFAULT_TV_TPL;

  // ── Folder pickers ────────────────────────────────────────
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
    <PageShell padding="md" gap="md">
      <PageHeader
        left={<h1 className="text-sm font-bold">{t("nav.settings")}</h1>}
        noBorder
      />

      {/* ── ABOUT ──────────────────────────────────────────── */}
      <section className="w-full space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <AppWindowMac className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold">{t("app.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("settings.about.version")}
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("settings.about.description")}
        </p>
      </section>

      {/* ── NAMING TEMPLATES ──────────────────────────────── */}
      <section className="w-full space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Tag className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold">{t("settings.templates")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("settings.templates.hint")}
            </p>
          </div>
        </div>

        {/* Variable chips */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("settings.templates.variables")}
          </p>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {TEMPLATE_VARS.map((v) => (
              <Tooltip key={v}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => insertVar(v)}
                      className="rounded-lg border bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {`{${v}}`}
                    </button>
                  }
                />
                <TooltipContent>
                  {t(`settings.templates.var.${v}`)}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Movie template */}
        <TemplateField
          id="tpl-movie"
          label={t("settings.template.movie")}
          value={movieTpl}
          sample={`${renderTemplatePreview(movieTpl || DEFAULT_MOVIE_TPL)}.mkv`}
          modified={movieTemplateModified}
          onReset={resetMovieTemplate}
          onChange={(v) => {
            setMovieTpl(v);
            saveSetting("templates.movie", v.trim());
          }}
          onFocus={() => (lastFocused.current = "movie")}
        />

        {/* TV template */}
        <TemplateField
          id="tpl-tv"
          label={t("settings.template.tv")}
          value={tvTpl}
          sample={`${renderTemplatePreview(tvTpl || DEFAULT_TV_TPL)}.mkv`}
          modified={tvTemplateModified}
          onReset={resetTvTemplate}
          onChange={(v) => {
            setTvTpl(v);
            saveSetting("templates.tv", v.trim());
          }}
          onFocus={() => (lastFocused.current = "tv")}
        />
      </section>

      {/* ── DESTINATION FOLDERS ───────────────────────────── */}
      <section className="w-full space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FolderInput className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold">{t("settings.folders")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("settings.folders.hint")}
            </p>
          </div>
        </div>

        <FolderRow
          id="dest-movie"
          label={t("settings.folders.movieLabel")}
          description={t("settings.folders.movieHint")}
          value={destMovie}
          onChoose={() => chooseFolder("folders.movie")}
          onClear={() => clearFolder("folders.movie")}
        />

        <FolderRow
          id="dest-tv"
          label={t("settings.folders.tvLabel")}
          description={t("settings.folders.tvHint")}
          value={destTv}
          onChoose={() => chooseFolder("folders.tv")}
          onClear={() => clearFolder("folders.tv")}
        />

        <p className="text-xs text-muted-foreground">
          {t("settings.folders.default")}
        </p>
      </section>
    </PageShell>
  );
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────

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
  modified,
  onReset,
  onChange,
  onFocus,
}: {
  id: string;
  label: string;
  value: string;
  sample: string;
  modified: boolean;
  onReset: () => void;
  onChange: (v: string) => void;
  onFocus: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} dir="ltr">
          {label}
        </Label>
        {modified && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-1.5 text-xs"
            onClick={onReset}
          >
            <RotateCcw className="size-3" />
            {t("settings.template.reset")}
          </Button>
        )}
      </div>
      <Input
        id={id}
        dir="ltr"
        value={value}
        placeholder={t("settings.template.empty")}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      <p
        dir="ltr"
        className="truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs font-semibold"
      >
        {sample}
      </p>
      <p dir="ltr" className="text-start text-[11px] text-muted-foreground">
        {t("settings.template.preview")}
      </p>
    </div>
  );
}

/** A folder row with path input, Choose, and Clear buttons. */
function FolderRow({
  id,
  label,
  description,
  value,
  onChoose,
  onClear,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  onChoose: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <PathInput id={id} value={value} />
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={onChoose}
        >
          {t("settings.folders.pick")}
        </Button>
        {value && (
          <Button type="button" variant="outline" onClick={onClear}>
            {t("settings.folders.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
