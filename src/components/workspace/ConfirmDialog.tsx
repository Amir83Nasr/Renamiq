// ── FINAL CONFIRMATION DIALOG ────────────────────────────────
// Last gate before filesystem mutation: counts + old→new preview list.

import { AlertTriangle, ArrowRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const items = plan?.items ?? [];
  // Executable = ready items; needs-review and conflicts stay untouched.
  const executable = items.filter((i) => i.status === "ready");
  const counts = statusCounts(items);

  return (
    <AlertDialog
      open={open && executable.length > 0}
      onOpenChange={(o) => !o && onCancel()}
    >
      <AlertDialogContent size="default" className="max-w-xl!">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("confirm.title", { count: executable.length })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirm.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

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

        {/* Old → new preview for everything about to run. */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("confirm.preview")}
          </p>
          <ul
            className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-card p-2"
            dir="ltr"
          >
            {executable.map((i) => (
              <li key={i.path} className="flex items-center gap-2 px-1 py-0.5">
                <span className="truncate text-xs text-muted-foreground line-through">
                  {i.originalName}
                </span>
                <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" />
                <span className="truncate text-xs font-semibold">
                  {i.newName}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {counts.conflict > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {t("confirm.hasConflicts", { count: counts.conflict })}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("confirm.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={planning}>
            {t("confirm.rename")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
