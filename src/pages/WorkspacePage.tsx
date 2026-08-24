// ── WORKSPACE PAGE ───────────────────────────────────────────
// Single flow: import → review (list + editor) → confirm → result.

import {
  CheckCircle2,
  Eraser,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/workspace/ConfirmDialog";
import { Dropzone } from "@/components/workspace/Dropzone";
import { FileEditor } from "@/components/workspace/FileEditor";
import { FileList } from "@/components/workspace/FileList";
import { type MessageKey, t } from "@/i18n";
import { executeOperations } from "@/lib/tauri";
import { statusCounts, useWorkspace } from "@/stores/workspace";

export default function WorkspacePage() {
  const ws = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const counts = statusCounts(ws.plan?.items ?? []);

  if (ws.phase === "import") return <Dropzone />;

  if (ws.phase === "result") return <ResultView />;

  const executable = (ws.plan?.items ?? []).filter((i) => i.status === "ready");

  const runRename = async () => {
    setConfirming(false);
    try {
      const res = await executeOperations(executable, ws.resolutions);
      ws.finishExecution(new Map(res.map((r) => [r.path, r.ok])));
    } catch (err) {
      console.error(err);
      ws.finishExecution(new Map());
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar: batch summary + organize toggle + actions */}
      <header className="flex items-center gap-3 border-b bg-background/60 px-5 py-3">
        <Badge variant="secondary">
          {t("workspace.fileCount", { count: ws.files.length })}
        </Badge>
        <span
          className="flex items-center gap-1 text-xs text-success"
          dir="ltr"
        >
          ● {counts.ready}
        </span>
        {counts.needsReview > 0 && (
          <span className="text-xs text-warning" dir="ltr">
            ● {counts.needsReview}
          </span>
        )}
        {counts.conflict > 0 && (
          <span className="text-xs text-destructive" dir="ltr">
            ● {counts.conflict}
          </span>
        )}
        {counts.errors > 0 && (
          <span className="text-xs text-destructive/70" dir="ltr">
            ● {counts.errors}
          </span>
        )}

        <div className="ms-auto flex items-center gap-3">
          {/* biome-ignore lint/a11y/noLabelWithoutControl: Switch renders a button */}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            {t("workspace.organizeIntoFolders")}
            <Switch
              checked={ws.organize}
              onCheckedChange={ws.setOrganize}
              aria-label={t("workspace.organizeIntoFolders")}
            />
          </label>
          <Button variant="ghost" size="sm" onClick={ws.clearAll}>
            <Eraser /> {t("workspace.clear")}
          </Button>
          <Button
            size="sm"
            disabled={executable.length === 0 || ws.planning}
            onClick={() => setConfirming(true)}
          >
            <ShieldCheck />
            {t("confirm.rename")}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          <FileList />
        </div>
        {ws.selected && <FileEditor key={ws.selected} />}
      </div>

      <ConfirmDialog
        open={confirming}
        onConfirm={() => void runRename()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

/** Execution outcome summary. */
function ResultView() {
  const { results, clearAll } = useWorkspace();
  const ok = [...results.values()].filter(Boolean).length;
  const failed = results.size - ok;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="rounded-full bg-success/15 p-6">
        <CheckCircle2 className="size-10 text-success" />
      </div>
      <p className="text-lg font-bold">{t("result.done", { ok })}</p>
      {failed > 0 && (
        <p className="text-sm text-destructive">
          {t("result.failed", { failed })}
        </p>
      )}
      <ul
        className="max-h-64 w-full max-w-lg space-y-1 overflow-y-auto rounded-xl border bg-card p-2 text-xs"
        dir="ltr"
      >
        {[...results.entries()].map(([path, success]) => (
          <li key={path} className="flex items-center gap-2 px-2 py-1">
            {success ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-success" />
            ) : (
              <XCircle className="size-3.5 shrink-0 text-destructive" />
            )}
            <span className="truncate text-muted-foreground">
              {path.split(/[\\/]/).pop()}
            </span>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={clearAll}>
        <RotateCcw /> {t("result.close")}
      </Button>
    </div>
  );
}

export function warnLabel(key: MessageKey): string {
  return t(key);
}
