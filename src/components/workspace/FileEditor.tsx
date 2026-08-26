// ── FILE EDITOR (MANUAL OVERRIDE) ────────────────────────────

import { Captions as CaptionsIcon, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SubkadeDialog } from "@/components/workspace/SubkadeDialog";
import { type MessageKey, t } from "@/i18n";
import { useWorkspace } from "@/stores/workspace";
import type { MediaKind } from "@/types/media";

/** Side panel for the selected file. Every change replans instantly. */
export function FileEditor() {
  const {
    plan,
    files,
    selected,
    setSelected,
    overrides,
    setOverride,
    clearOverride,
  } = useWorkspace();

  const [subkadeOpen, setSubkade] = useState(false);
  const file = files.find((f) => f.path === selected);
  const item = plan?.items.find((i) => i.path === selected);
  const ovr = selected ? (overrides[selected] ?? {}) : {};

  // State lives in the store; typing updates zustand synchronously and the
  // plan rebuild is debounced in replan(). No local mirrors to resync.
  if (!file || !item) return null;

  const kind: MediaKind = ovr.kind ?? file.parsed?.kind ?? "unknown";
  const title = ovr.title ?? "";
  const customName = ovr.customName ?? "";
  const isSubtitle = file.role === "subtitle";

  const commitTitle = (value: string) => {
    if (value.trim()) setOverride(file.path, { title: value });
    else clearField("title");
  };

  const clearField = (field: "title" | "year" | "season" | "episode") => {
    const next = { ...ovr };
    delete next[field];
    if (Object.keys(next).length === 0) clearOverride(file.path);
    else setOverride(file.path, next);
  };

  return (
    <aside className="flex w-64 shrink-0 basis-56 grow-0 overflow-y-auto border-s bg-card p-2 xl:w-80 xl:basis-72">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("editor.title")}</h3>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
                aria-label={t("confirm.cancel")}
              />
            }
          >
            <X className="size-4" />
          </TooltipTrigger>
          <TooltipContent>{t("confirm.cancel")}</TooltipContent>
        </Tooltip>
      </header>

      <Tooltip>
        <TooltipTrigger
          render={
            <p className="cursor-default truncate rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground" />
          }
        >
          {item.originalName}
        </TooltipTrigger>
        <TooltipContent side="bottom">{item.originalName}</TooltipContent>
      </Tooltip>

      {!isSubtitle && (
        <Button variant="outline" size="sm" onClick={() => setSubkade(true)}>
          <CaptionsIcon /> {t("subkade.download")}
        </Button>
      )}

      {isSubtitle ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ed-lang">{t("subtitle.language")}</Label>
            <Select
              id="ed-lang"
              value={ovr.language ?? item.language ?? ""}
              onChange={(e) =>
                setOverride(file.path, {
                  language: e.target.value || undefined,
                })
              }
            >
              <option value="">{t("subtitle.none")}</option>
              <option value="fa">فارسی (fa)</option>
              <option value="en">English (en)</option>
              <option value="ar">العربية (ar)</option>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("subtitle.attachedTo")}
          </p>
          <div className="mt-auto flex cursor-pointer items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <EyeOff className="size-4" />
              {t("editor.exclude")}
            </span>
            <Switch
              checked={Boolean(ovr.exclude)}
              onCheckedChange={(on) => setOverride(file.path, { exclude: on })}
              aria-label={t("editor.exclude")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("editor.preview")}</Label>
            <p className="break-all rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary">
              {item.newName}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ed-title">{t("editor.field.title")}</Label>
            <Input
              id="ed-title"
              dir="auto"
              value={title}
              placeholder={file.parsed?.title || ""}
              onChange={(e) => commitTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-kind">{t("editor.field.type")}</Label>
            <Select
              id="ed-kind"
              value={kind}
              onChange={(e) =>
                setOverride(file.path, { kind: e.target.value as MediaKind })
              }
            >
              <option value="movie">{t("editor.type.movie")}</option>
              <option value="tv">{t("editor.type.tv")}</option>
              <option value="unknown">{t("editor.type.unknown")}</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <NumField
              id="ed-year"
              label={t("editor.field.year")}
              value={ovr.year ?? file.parsed?.year ?? undefined}
              onChange={(v) => setOverride(file.path, { year: v })}
              onClear={() => clearField("year")}
            />
            <NumField
              id="ed-season"
              label={t("editor.field.season")}
              value={ovr.season ?? file.parsed?.season ?? undefined}
              onChange={(v) => setOverride(file.path, { season: v })}
              onClear={() => clearField("season")}
            />
            <NumField
              id="ed-episode"
              label={t("editor.field.episode")}
              value={ovr.episode ?? file.parsed?.episode ?? undefined}
              onChange={(v) => setOverride(file.path, { episode: v })}
              onClear={() => clearField("episode")}
            />
          </div>

          {/* Custom name bypasses templates entirely. */}
          <div className="space-y-1.5 rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ed-custom">{t("editor.customName")}</Label>
              <Switch
                checked={Boolean(customName)}
                onCheckedChange={(on) =>
                  setOverride(file.path, {
                    customName: on
                      ? ovr.customName ||
                        item.originalName.replace(/\.[^.]+$/, "")
                      : undefined,
                  })
                }
                aria-label={t("editor.customName")}
              />
            </div>
            {customName && (
              <>
                <Input
                  id="ed-custom"
                  dir="auto"
                  value={customName}
                  onChange={(e) =>
                    setOverride(file.path, { customName: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("editor.customNameHint")}
                </p>
              </>
            )}
          </div>

          <div className="mt-auto flex cursor-pointer items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <EyeOff className="size-4" />
              {t("editor.exclude")}
            </span>
            <Switch
              checked={Boolean(ovr.exclude)}
              onCheckedChange={(on) => setOverride(file.path, { exclude: on })}
              aria-label={t("editor.exclude")}
            />
          </div>

          {/* LIVE PREVIEW — always reflects current fields. */}
          <div className="space-y-1.5">
            <Label>{t("editor.preview")}</Label>
            <p className="break-all rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary">
              {item.status === "error" ? "—" : item.newName}
            </p>
          </div>
        </>
      )}
      {subkadeOpen && (
        <SubkadeDialog
          videoPath={file.path}
          onClose={() => setSubkade(false)}
        />
      )}
    </aside>
  );
}

function NumField({
  id,
  label,
  value,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isNaN(n)) onClear();
          else onChange(n);
        }}
      />
    </div>
  );
}

export function warnKeys(warnings: string[]): MessageKey[] {
  return warnings.map((w) => `warn.${w}` as MessageKey);
}
