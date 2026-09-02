// ── IMPORT DROPZONE ──────────────────────────────────────────

import { FilePlus, FolderOpen, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileDrop } from "@/hooks/useFileDrop";
import { t } from "@/i18n";
import { pickFiles, pickFolder } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";

export function Dropzone() {
  const { importPaths, scanning, error } = useWorkspace();

  const isDragging = useFileDrop((paths) => {
    void importPaths(paths, false);
  });

  const pickAndImport = async (folderMode: boolean) => {
    const picked = folderMode ? await pickFolder() : await pickFiles();
    if (picked)
      await importPaths(Array.isArray(picked) ? picked : [picked], folderMode);
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <div
        className={cn(
          "flex flex-col items-center gap-5 rounded-xl border-2 border-dashed px-10 py-12 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          error && "border-destructive",
        )}
      >
        <div className="rounded-full bg-primary/10 p-6">
          <Import className="size-10 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">{t("workspace.drop.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("workspace.drop.or")}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            disabled={scanning}
            onClick={() => void pickAndImport(false)}
          >
            <FilePlus /> {t("workspace.pickFiles")}
          </Button>
          <Button disabled={scanning} onClick={() => void pickAndImport(true)}>
            <FolderOpen /> {t("workspace.pickFolder")}
          </Button>
        </div>
        {scanning && (
          <p className="text-sm text-muted-foreground">
            {t("workspace.scanning")}
          </p>
        )}
        {error && (
          <p className="max-w-sm text-sm text-destructive">
            {t("error.generic")}
          </p>
        )}
      </div>
    </section>
  );
}
