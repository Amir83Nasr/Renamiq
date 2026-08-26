// ── OPERATION HISTORY ────────────────────────────────────────

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { listOperations, undoLastOperation } from "@/lib/tauri";
import type { OperationHistoryItem } from "@/types/media";

export default function HistoryPage() {
  const [ops, setOps] = useState<OperationHistoryItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      listOperations()
        .then(setOps)
        .catch((err) => {
          console.error(err);
          setError(String(err));
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

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

  // undo_last_operation always reverts the newest journaled op, so only
  // the first can-undo row may offer it.
  const undoIndex = ops?.findIndex((op) => op.canUndo) ?? -1;

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("error.generic")}
        </p>
      )}
      {!ops ? null : ops.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
      ) : (
        <ScrollArea className="min-h-0 flex-1 rounded-xl border bg-card">
          <ul className="divide-y divide-border">
            {ops.map((op, i) => (
              <li
                key={op.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <Badge
                  variant={op.status === "completed" ? "success" : "warning"}
                >
                  {op.status}
                </Badge>
                <span dir="ltr" className="min-w-0 truncate font-medium">
                  {op.summary}
                </span>
                <span dir="ltr" className="text-xs text-muted-foreground">
                  {t("history.items", { count: op.itemCount })}
                </span>
                <time
                  dir="ltr"
                  className="ms-auto text-xs text-muted-foreground/70"
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

/** SQLite datetime('now') is UTC "YYYY-MM-DD HH:MM:SS" — normalize to ISO. */
function formatTime(s: string): string {
  const d = new Date(`${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
