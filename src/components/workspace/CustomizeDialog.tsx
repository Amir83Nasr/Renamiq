// ── PER-FILE CUSTOMIZE DIALOG ────────────────────────────────

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { useWorkspace } from "@/stores/workspace";

export function CustomizeDialog({
  filePath,
  open,
  onClose,
}: {
  filePath: string;
  open: boolean;
  onClose: () => void;
}) {
  const { overrides, setOverride } = useWorkspace();
  const [includeSeason, setIncludeSeason] = useState(true);
  const [episodeDigits, setEpisodeDigits] = useState(2);

  // Sync local state when dialog opens or target file changes.
  useEffect(() => {
    if (open) {
      const ovr = overrides[filePath] ?? {};
      setIncludeSeason(ovr.includeSeason ?? true);
      setEpisodeDigits(ovr.episodeDigits ?? 2);
    }
  }, [open, filePath, overrides]);

  const apply = () => {
    setOverride(filePath, { includeSeason, episodeDigits });
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("editor.customizeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("editor.customizeHint")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="cust-season">{t("editor.includeSeason")}</Label>
            <Switch
              id="cust-season"
              checked={includeSeason}
              onCheckedChange={setIncludeSeason}
              aria-label={t("editor.includeSeason")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-digits">{t("editor.episodeDigits")}</Label>
            <Select
              id="cust-digits"
              value={String(episodeDigits)}
              onChange={(e) => setEpisodeDigits(Number(e.target.value))}
            >
              <option value="2">{t("editor.episodeDigits.2")}</option>
              <option value="3">{t("editor.episodeDigits.3")}</option>
            </Select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            {t("confirm.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={apply}>
            {t("editor.customizeApply")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
