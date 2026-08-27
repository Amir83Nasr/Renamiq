// ── SUBTITLE REMOVAL PAGE ──────────────────────────────────────

import { FileVideo, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";
import { pickFiles, removeSubtitle } from "@/lib/tauri";

export default function RemoveSubtitlePage() {
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickVideo = async () => {
    const picked = await pickFiles();
    if (picked?.length) setVideo(picked[0]);
  };

  const remove = async () => {
    if (!video) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const out = await removeSubtitle(video);
      setDone(out);
    } catch (err) {
      setError(String(err));
    }
    setBusy(false);
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-2">
      {/* Video picker */}
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void pickVideo()}>
          <FileVideo /> {t("remove.pickVideo")}
        </Button>
        {video ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  dir="ltr"
                  className="cursor-default truncate text-xs text-muted-foreground"
                />
              }
            >
              {video}
            </TooltipTrigger>
            <TooltipContent>{video}</TooltipContent>
          </Tooltip>
        ) : (
          <span dir="ltr" className="text-xs text-muted-foreground">
            {t("remove.noneSelected")}
          </span>
        )}
      </div>

      {/* Run button */}
      <div className="flex items-end gap-2">
        <Button
          size="sm"
          className="shrink-0"
          disabled={busy || !video}
          onClick={() => void remove()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {t("remove.run")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p dir="ltr" className="text-xs text-success">
          {t("remove.done", { file: done })}
        </p>
      )}

      {!done && !error && (
        <p className="px-3 py-10 text-center text-xs text-muted-foreground">
          {t("remove.hint")}
        </p>
      )}
    </div>
  );
}
