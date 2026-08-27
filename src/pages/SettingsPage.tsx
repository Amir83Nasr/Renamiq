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

// ── MODEL PROVIDER / MODEL NAME MAP ─────────────────────────
const MODEL_OPTIONS: Record<string, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "o3-mini"],
  google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  ollama: ["llama3.1", "mistral", "codellama", "gemma2", "phi3"],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  ollama: "Ollama (Local)",
};

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

  // ── Model Configuration ───────────────────────────────────
  const [modelProvider, setModelProvider] = useState("anthropic");
  const [modelName, setModelName] = useState("claude-sonnet-4-20250514");
  const [modelTemp, setModelTemp] = useState("0.7");
  const [modelMaxTokens, setModelMaxTokens] = useState("4096");
  const [modelApiKey, setModelApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

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
        const savedProvider = s["model.provider"] || "anthropic";
        setModelProvider(savedProvider);
        setModelName(
          s["model.name"] || MODEL_OPTIONS[savedProvider]?.[0] || "",
        );
        setModelTemp(s["model.temperature"] || "0.7");
        setModelMaxTokens(s["model.maxTokens"] || "4096");
        setModelApiKey(s["model.apiKey"] || "");
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

  // ── Provider change: reset model name to first option ──────
  const onProviderChange = (provider: string) => {
    setModelProvider(provider);
    const firstModel = MODEL_OPTIONS[provider]?.[0] || "";
    setModelName(firstModel);
    saveSetting("model.provider", provider);
    saveSetting("model.name", firstModel);
  };

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

  // ── Available models for current provider ──────────────────
  const availableModels = MODEL_OPTIONS[modelProvider] || [];

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-4">
      {/* ── NAMING TEMPLATES ──────────────────────────────── */}
      <section className="w-full space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-2">
          <h2 className="text-sm font-bold">{t("settings.templates")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("settings.templates.hint")}
          </p>
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
            saveSetting("templates.movie", v.trim());
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
            saveSetting("templates.tv", v.trim());
          }}
          onFocus={() => (lastFocused.current = "tv")}
        />
      </section>

      {/* ── DESTINATION FOLDERS ───────────────────────────── */}
      <section className="w-full space-y-3 rounded-2xl border bg-card p-4">
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

      {/* ── AI MODEL CONFIGURATION ────────────────────────── */}
      <section className="w-full space-y-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold">{t("settings.model")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("settings.model.hint")}
          </p>
        </div>

        {/* Provider + Model row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="model-provider">
              {t("settings.model.provider")}
            </Label>
            <Select
              id="model-provider"
              value={modelProvider}
              onChange={onProviderChange}
              options={Object.entries(PROVIDER_LABELS).map(
                ([value, label]) => ({
                  value,
                  label,
                }),
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model-name">{t("settings.model.name")}</Label>
            <Select
              id="model-name"
              value={modelName}
              onChange={(v) => {
                setModelName(v);
                saveSetting("model.name", v);
              }}
              options={availableModels.map((m) => ({ value: m, label: m }))}
            />
          </div>
        </div>

        {/* Temperature + Max tokens row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="model-temp">
              {t("settings.model.temperature")}{" "}
              <span className="font-mono text-muted-foreground">
                {modelTemp}
              </span>
            </Label>
            <input
              id="model-temp"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={modelTemp}
              onChange={(e) => {
                setModelTemp(e.target.value);
                saveSetting("model.temperature", e.target.value);
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model-tokens">
              {t("settings.model.maxTokens")}
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="model-tokens"
                type="range"
                min="256"
                max="16384"
                step="256"
                value={modelMaxTokens}
                onChange={(e) => {
                  setModelMaxTokens(e.target.value);
                  saveSetting("model.maxTokens", e.target.value);
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="w-14 shrink-0 rounded-md bg-muted px-1.5 py-1 text-center font-mono text-xs">
                {modelMaxTokens}
              </span>
            </div>
          </div>
        </div>

        {/* API Key with show/hide toggle */}
        <div className="space-y-1.5">
          <Label htmlFor="model-apikey">{t("settings.model.apiKey")}</Label>
          <div className="flex gap-2">
            <Input
              id="model-apikey"
              type={apiKeyVisible ? "text" : "password"}
              dir="ltr"
              placeholder="sk-..."
              value={modelApiKey}
              onChange={(e) => {
                setModelApiKey(e.target.value);
                saveSetting("model.apiKey", e.target.value);
              }}
              className="flex-1 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => setApiKeyVisible((v) => !v)}
            >
              {apiKeyVisible ? "Hide" : "Show"}
            </Button>
          </div>
          {modelProvider === "ollama" && (
            <p className="text-xs text-muted-foreground">
              Ollama runs locally — no API key required.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────

/** Native <select> styled to match the design system. */
function Select({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
