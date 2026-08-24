// ── FINAL CONFIRMATION DIALOG ────────────────────────────────
// Last gate before filesystem mutation: counts + unresolved-conflict notice.

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { statusCounts, useWorkspace } from "@/stores/workspace";

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { plan, planning } = useWorkspace();
  if (!open || !plan) return null;

  const counts = statusCounts(plan.items);
  // Executable = ready items; needs-review and conflicts stay untouched.
  const executable = plan.items.filter((i) => i.status === "ready").length;
  if (executable === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-5 shadow-xl">
        <div className="space-y-1">
          <h2 id="confirm-title" className="text-base font-bold">
            {t("confirm.title", { count: executable })}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("confirm.description")}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-muted/60 p-3 text-sm">
          <Row
            label={t("confirm.ready")}
            value={counts.ready}
            tone="text-success"
          />
          <Row
            label={t("confirm.warnings")}
            value={counts.needsReview}
            tone="text-warning"
          />
          <Row
            label={t("confirm.conflicts")}
            value={counts.conflict}
            tone="text-destructive"
          />
          <Row
            label={t("confirm.errors")}
            value={counts.errors}
            tone="text-destructive"
          />
        </dl>

        {counts.conflict > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {t("confirm.hasConflicts", { count: counts.conflict })}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("confirm.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={planning}>
            {t("confirm.rename")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-end font-semibold ${tone}`} dir="ltr">
        {value}
      </dd>
    </>
  );
}
