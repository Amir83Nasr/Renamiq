// ── OPERATION HISTORY ────────────────────────────────────────

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type MessageKey, t } from "@/i18n";
import { listOperations, undoLastOperation } from "@/lib/tauri";
import type { OperationHistoryItem } from "@/types/media";

/** `active` is the page's visibility: App keeps every page mounted. */
export default function HistoryPage({ active }: { active: boolean }) {
  const [ops, setOps] = useState<OperationHistoryItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOps(await listOperations());
      setError(null);
    } catch (err) {
      console.error(err);
      setError(String(err));
    }
  }, []);

  // Refetch on every activation: renames performed in the workspace while
  // this page sat hidden would otherwise never appear.
  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const undo = async () => {
    setBusy(true);
    try {
      await undoLastOperation();
      await load();
    } catch (err) {
      console.error(err);
      setError(String(err));
    }
    setBusy(false);
  };

  // undo_last_operation always reverts the newest reversible op, so only the
  // first can-undo row may offer it.
  const undoIndex = ops?.findIndex((op) => op.canUndo) ?? -1;

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 p-2">
      <header className="flex items-center gap-2">
        {ops && ops.length > 0 && (
          <Badge variant="secondary">
            {t("history.count", { count: ops.length })}
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto"
          disabled={busy}
          onClick={() => void load()}
        >
          <RotateCcw /> {t("history.refresh")}
        </Button>
      </header>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p role="alert" className="text-sm text-destructive">
            {t("error.generic")}
          </p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            {t("history.retry")}
          </Button>
        </div>
      ) : !ops ? (
        <p className="p-2 text-sm text-muted-foreground">
          {t("history.loading")}
        </p>
      ) : ops.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium">{t("history.empty")}</p>
          <p className="text-xs text-muted-foreground">
            {t("history.emptyHint")}
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 rounded-xl border bg-card">
          <ul className="divide-y divide-border">
            {ops.map((op, i) => (
              <li
                key={op.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <Badge variant={STATUS_VARIANT[statusOf(op)] ?? "secondary"}>
                  {t(statusLabel(op))}
                </Badge>
                <div className="flex min-w-0 flex-col">
                  <span dir="ltr" className="truncate font-medium">
                    {t(kindLabel(op.kind))}
                  </span>
                  <span dir="ltr" className="text-xs text-muted-foreground">
                    {t("history.items", { count: op.itemCount })}
                  </span>
                </div>
                <time
                  dir="ltr"
                  dateTime={toIso(op.createdAt)}
                  className="ms-auto shrink-0 text-xs text-muted-foreground/70"
                >
                  {formatTime(op.createdAt)}
                </time>
                {i === undoIndex && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void undo()}
                  >
                    <RotateCcw /> {t("history.undo")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

// ── LABELS ───────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  completed: "success",
  partial: "warning",
  failed: "destructive",
  undone: "warning",
};

/** An undone row reads as "undone" regardless of how it originally ended. */
function statusOf(op: OperationHistoryItem): string {
  return op.undoneAt ? "undone" : op.status;
}

function statusLabel(op: OperationHistoryItem): MessageKey {
  const key = `history.status.${statusOf(op)}`;
  return (isMessageKey(key) ? key : "history.status.completed") as MessageKey;
}

function kindLabel(kind: string): MessageKey {
  const key = `history.kind.${kind}`;
  return (isMessageKey(key) ? key : "history.kind.rename") as MessageKey;
}

/** Backend statuses/kinds are open strings; fall back rather than print raw. */
function isMessageKey(key: string): boolean {
  return t(key as MessageKey) !== key;
}

// ── TIME ─────────────────────────────────────────────────────

/** SQLite datetime('now') is UTC "YYYY-MM-DD HH:MM:SS" — normalize to ISO. */
function toIso(s: string): string {
  return `${s.replace(" ", "T")}Z`;
}

function formatTime(s: string): string {
  const d = new Date(toIso(s));
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
