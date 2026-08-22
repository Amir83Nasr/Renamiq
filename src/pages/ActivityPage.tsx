import { History, Undo2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOperations } from "@/hooks/useOperations";

export default function ActivityPage() {
  const { operations, loading, refresh, undo } = useOperations();
  const [undoing, setUndoing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleUndo = async () => {
    setUndoing(true);
    setMessage(null);
    try {
      const result = await undo();
      setMessage(result);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Activity</h1>
        <div className="flex gap-2">
          {operations.some((o) => o.canUndo) && (
            <Button variant="outline" onClick={handleUndo} disabled={undoing}>
              <Undo2 /> Undo last
            </Button>
          )}
          <Button variant="ghost" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </header>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {loading && operations.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!loading && operations.length === 0 && (
        <Card className="mx-auto mt-16 max-w-md border-dashed">
          <CardHeader className="items-center text-center">
            <History className="size-10 text-muted-foreground" />
            <CardTitle>No activity yet</CardTitle>
            <CardDescription>
              Applied renames will appear here with undo support.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <ScrollArea className="flex-1">
        <ul className="divide-y divide-border rounded-lg border bg-card">
          {operations.map((op) => (
            <li
              key={op.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <Badge
                variant={op.status === "completed" ? "success" : "destructive"}
              >
                {op.kind}
              </Badge>
              <span className="flex-1">{op.summary}</span>
              <span className="text-xs text-muted-foreground">
                {op.createdAt}
              </span>
              {op.canUndo &&
                op.id ===
                  Math.max(
                    ...operations.filter((o) => o.canUndo).map((o) => o.id),
                  ) && <Badge variant="secondary">undoable</Badge>}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
