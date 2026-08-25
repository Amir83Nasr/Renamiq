// ── SUBKADE SUBTITLE SEARCH ──────────────────────────────────

import { Download, Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";
import {
  type SubkadeResult,
  subkadeDownload,
  subkadeSearch,
} from "@/lib/tauri";

/** Modal search over subkade.ir; downloads the Persian subtitle zip and
 *  extracts it next to the target video. */
export function SubkadeDialog({
  videoPath,
  onClose,
}: {
  videoPath: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(queryFromVideo(videoPath));
  const [results, setResults] = useState<SubkadeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await subkadeSearch(q));
    } catch (err) {
      setError(String(err));
    }
    setSearching(false);
  };

  const download = async (r: SubkadeResult) => {
    setDownloading(r.url);
    setError(null);
    try {
      const files = await subkadeDownload(r.url, videoPath);
      setDone(files.length > 0 ? files.join("\n") : null);
    } catch (err) {
      setError(String(err));
    }
    setDownloading(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("subkade.title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 rounded-2xl border bg-card p-4 shadow-2xl">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("subkade.title")}</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    aria-label={t("confirm.cancel")}
                  />
                }
              >
                <X className="size-4" />
              </TooltipTrigger>
              <TooltipContent>{t("confirm.cancel")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </header>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <Input
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("subkade.placeholder")}
          />
          <Button type="submit" size="sm" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {t("subkade.search")}
          </Button>
        </form>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {done && (
          <p className="text-xs text-success">
            {t("subkade.done", { files: done })}
          </p>
        )}

        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {results?.map((r) => (
            <li key={r.url}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-xs hover:bg-accent/50"
                disabled={downloading !== null}
                onClick={() => void download(r)}
              >
                <span dir="ltr" className="truncate font-medium">
                  {r.title}
                </span>
                {downloading === r.url ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <Download className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
          {results !== null && results.length === 0 && !searching && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("subkade.empty")}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** "Movie.2026.1080p.mkv" → "Movie 2026" — a decent initial search query. */
function queryFromVideo(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? "";
  const stem = name.replace(/\.[^.]+$/, "");
  // ponytail: crude token strip (resolution/group words); parser-based
  // query building lands with TMDB metadata.
  return stem
    .replace(/\.(1080p|720p|2160p|480p|x265|x264|WEB-DL|WEB|BluRay|HDR)/gi, " ")
    .replace(/[-._]/g, " ")
    .trim();
}
