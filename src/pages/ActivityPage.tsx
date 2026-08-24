// ── ACTIVITY (HISTORY + UNDO) ────────────────────────────────

import { History, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { listOperations, undoLastOperation } from "@/lib/tauri";
import type { OperationHistoryItem } from "@/types/media";

export default function ActivityPage() {
  const [operations, setOperations] = useState<OperationHistoryItem[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOperations(await listOperations());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const undoableIds = operations.filter((o) => o.canUndo).map((o) => o.id);
  const latestUndoable = Math.max(-1, ...undoableIds);

  const handleUndo = async () => {
    setUndoing(true);
    setMessage(null);
    try {
      setMessage(await undoLastOperation());
      await refresh();
    } catch (err) {
      console.error(err);
      setMessage(t("error.generic"));
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("activity.title")}</h1>
        <div className="flex gap-2">
          {latestUndoable >= 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleUndo()}
              disabled={undoing}
            >
              <Undo2 /> {undoing ? t("activity.undoing") : t("activity.undo")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            {t("activity.refresh")}
          </Button>
        </div>
      </header>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {operations.length === 0 ? (
        <div className="mx-auto mt-16 max-w-md space-y-2 rounded-3xl border border-dashed p-10 text-center">
          <History className="mx-auto size-10 text-muted-foreground" />
          <p className="font-semibold">{t("activity.empty.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("activity.empty.hint")}
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 rounded-xl border bg-card">
          <ul className="divide-y divide-border">
            {operations.map((op) => (
              <li
                key={op.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <Badge
                  variant={
                    op.status === "completed" ? "success" : "destructive"
                  }
                >
                  {op.kind === "rename" ? t("confirm.rename") : op.kind}
                </Badge>
                <span className="flex-1">{op.summary}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {op.createdAt}
                </span>
                {op.canUndo && op.id === latestUndoable && (
                  <Badge variant="secondary">{t("activity.undoable")}</Badge>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
