// ── SUBKADE SUBTITLE SEARCH ──────────────────────────────────

import { FileImage, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";
import {
  onSubkadeProgress,
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
  const [progress, setProgress] = useState<Record<string, number | null>>({});
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onSubkadeProgress((p) => {
      if (p.total > 0) {
        const pct = Math.min(100, Math.round((p.downloaded / p.total) * 100));
        setProgress((prev) => ({ ...prev, [p.url]: pct }));
      } else {
        setProgress((prev) => ({ ...prev, [p.url]: prev[p.url] ?? null }));
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

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
    setProgress((prev) => ({ ...prev, [r.url]: null }));
    setError(null);
    try {
      const files = await subkadeDownload(r.url, videoPath);
      setDone(
        files.length > 0
          ? files.map((f) => f.split(/[\\/]/).pop()).join("\n")
          : null,
      );
    } catch (err) {
      setError(String(err));
    }
    setDownloading(null);
    setProgress((prev) => {
      const { [r.url]: _, ...rest } = prev;
      return rest;
    });
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
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-3 rounded-2xl border bg-card p-4 shadow-2xl">
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

        <ul className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {searching &&
            [1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i} className="flex flex-col gap-1">
                <Skeleton className="aspect-2/3 w-full rounded-lg" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))}
          {!searching &&
            results?.map((r) => {
              const isDownloading = downloading === r.url;
              const pct = progress[r.url];
              return (
                <li key={r.url} className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="group relative overflow-hidden rounded-lg border bg-accent/30 hover:bg-accent/60 disabled:opacity-50"
                    disabled={downloading !== null}
                    onClick={() => void download(r)}
                  >
                    {r.image ? (
                      <img
                        src={r.image}
                        alt={r.title}
                        className="aspect-2/3 w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to placeholder icon if image fails to
                          // load or is blocked
                          const target = e.currentTarget;
                          target.style.display = "none";
                          if (target.nextElementSibling) {
                            (
                              target.nextElementSibling as HTMLElement
                            ).style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={`flex aspect-2/3 w-full flex-col items-center justify-center gap-1 bg-accent/20 text-muted-foreground ${r.image ? "hidden" : "flex"}`}
                    >
                      <FileImage className="size-8 opacity-50" />
                    </div>
                    {isDownloading && (
                      <div className="absolute inset-x-0 bottom-0 bg-background/70 px-2 py-1 backdrop-blur-sm">
                        <p className="mb-1 text-center text-[10px] text-muted-foreground tabular-nums">
                          {pct === null
                            ? t("subkade.downloadingUnknown")
                            : t("subkade.downloading", { percent: pct })}
                        </p>
                        <Progress value={pct} />
                      </div>
                    )}
                  </button>
                  <p
                    dir="ltr"
                    className="truncate text-center text-[10px] text-muted-foreground"
                  >
                    {r.title}
                  </p>
                </li>
              );
            })}
          {results !== null && results.length === 0 && !searching && (
            <li className="col-span-full px-3 py-6 text-center text-xs text-muted-foreground">
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
