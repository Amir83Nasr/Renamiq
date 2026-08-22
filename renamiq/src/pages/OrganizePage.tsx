import { AlertTriangle, ArrowRight, Ban, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { t } from "@/i18n";
import { buildRenamePlan, executeOperations } from "@/lib/tauri";
import { useAppStore } from "@/stores/app";

export default function OrganizePage() {
  const { scan, plan, organize, setPlan, executing, setExecuting, setError } = useAppStore();
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, boolean>>(new Map());

  const regenerate = useCallback(async () => {
    if (!scan) return;
    try {
      const next = await buildRenamePlan(scan, organize);
      setPlan(next);
      setDisabledIds(new Set());
      setResults(new Map());
    } catch (err) {
      setError(String(err));
    }
  }, [scan, organize, setPlan, setError]);

  useEffect(() => {
    // Rebuild the plan whenever the scan or organize mode changes.
    void regenerate();
  }, [regenerate]);

  const ops = plan?.ops ?? [];
  const blockedCount = ops.filter((op) => op.collidesOnDisk).length;

  const toggle = (id: string, checked: boolean) => {
    setDisabledIds((prev) => {
      const next = new Set(prev);
      if (!checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleApply = async () => {
    if (!plan) return;
    setExecuting(true);
    setError(null);
    try {
      const toRun = plan.ops.filter((op) => !disabledIds.has(op.id) && !op.collidesOnDisk);
      const res = await executeOperations(toRun, []);
      setResults(new Map(res.map((r) => [r.id, r.ok])));
      await regenerate();
    } catch (err) {
      setError(String(err));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("organize.title")}</h1>
        <div className="flex items-center gap-2">
          {blockedCount > 0 && (
            <Badge variant="warning">
              <AlertTriangle /> {blockedCount} collision{blockedCount > 1 ? "s" : ""}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {t("organize.selected", { count: ops.length - disabledIds.size })}
          </span>
        </div>
      </header>

      {!scan && <p className="text-sm text-muted-foreground">Scan a folder first.</p>}
      {scan && plan && ops.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing to rename — all names are clean.</p>
      )}

      <ScrollArea className="flex-1 rounded-lg border bg-card">
        <ul className="divide-y divide-border">
          {ops.map((op) => {
            const resultOk = results.get(op.id);
            return (
              <li key={op.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <Checkbox
                  className="mt-1"
                  checked={!disabledIds.has(op.id)}
                  onCheckedChange={(c) => toggle(op.id, c)}
                  aria-label={`Include ${op.source}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-muted-foreground line-through decoration-border">
                    {fileName(op.source)}
                  </p>
                  <p className="flex items-center gap-2 truncate font-medium">
                    <ArrowRight className="size-3.5 shrink-0 text-primary" />
                    {fileName(op.destination)}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline">{op.kind}</Badge>
                    <span className="truncate">{dirName(op.destination)}</span>
                  </div>
                </div>
                {resultOk === true && <CheckCircle2 className="size-4 text-success" />}
                {resultOk === false && <Ban className="size-4 text-destructive" />}
                {op.collidesOnDisk && resultOk === undefined && (
                  <Badge variant="destructive">exists</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>

      {ops.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <p className="text-xs text-muted-foreground">
              Collisions are never replaced automatically. Skipped files stay untouched.
            </p>
            <Button onClick={handleApply} disabled={executing}>
              {executing ? "Applying…" : t("organize.apply")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fileName(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

function dirName(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : path;
}
