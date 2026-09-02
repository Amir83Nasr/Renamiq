// ── POSTERS PAGE (TMDB POSTER SEARCH + DOWNLOAD) ──────────────

import {
  CheckCircle2,
  FileImage,
  FolderOpen,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";
import {
  getSettings,
  onPosterProgress,
  pickFolder,
  type TmdbResult,
  tmdbDownloadPoster,
  tmdbSearch,
} from "@/lib/tauri";

interface PosterLog {
  id: string;
  title: string;
  file: string;
  year?: number | null;
  isTv: boolean;
}

export default function PostersPage() {
  const [query, setQuery] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [destDir, setDestDir] = useState<string | null>(null);
  const [results, setResults] = useState<TmdbResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  // null = no progress yet (indeterminate); number = 0..100 when total known.
  const [progress, setProgress] = useState<Record<number, number | null>>({});
  const [logs, setLogs] = useState<PosterLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (alive && s["tmdb.api_key"]) setApiKey(s["tmdb.api_key"]);
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onPosterProgress((p) => {
      if (p.total > 0) {
        const pct = Math.min(100, Math.round((p.downloaded / p.total) * 100));
        setProgress((prev) => ({ ...prev, [p.id]: pct }));
      } else {
        setProgress((prev) => ({ ...prev, [p.id]: prev[p.id] ?? null }));
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const searchControllerRef = useRef<AbortController | null>(null);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;

    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;

    setSearching(true);
    setError(null);
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(t("search.timeout"))), 10000),
      );
      const res = await Promise.race([tmdbSearch(q, apiKey), timeoutPromise]);
      if (controller.signal.aborted) return;
      setResults(res);
    } catch (err) {
      if (!controller.signal.aborted) setError(String(err));
    }
    if (!controller.signal.aborted) setSearching(false);
  };

  const startDownload = async (r: TmdbResult, targetFolder: string) => {
    setDownloading(r.id);
    setProgress((prev) => ({ ...prev, [r.id]: null }));
    setError(null);
    try {
      const file = await tmdbDownloadPoster(r, apiKey, targetFolder);
      setLogs((prev) => [
        {
          id: `${r.id}-${Date.now()}`,
          title: r.title,
          file: file.split(/[\\/]/).pop() ?? file,
          year: r.year,
          isTv: r.isTv,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(String(err));
    }
    setDownloading(null);
    setProgress((prev) => {
      const { [r.id]: _, ...rest } = prev;
      return rest;
    });
  };

  const handlePosterClick = async (r: TmdbResult) => {
    if (downloading !== null) return;
    let target = destDir;
    if (!target) {
      target = await pickFolder();
      if (!target) return;
      setDestDir(target);
    }
    void startDownload(r, target);
  };

  const handleReset = () => {
    searchControllerRef.current?.abort();
    setSearching(false);
    setQuery("");
    setResults(null);
    setError(null);
  };

  return (
    <PageShell>
      <PageHeader>
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <Input
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("posters.placeholder")}
          />
          <Button
            type="submit"
            size="sm"
            className="shrink-0"
            disabled={searching || !query.trim()}
          >
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {t("posters.search")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleReset}
          >
            <RotateCcw className="size-4" />
            {t("common.reset")}
          </Button>
        </form>
      </PageHeader>

      {/* Destination folder picker */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void pickFolder().then(setDestDir)}
        >
          <FolderOpen /> {t("settings.folders.pick")}
        </Button>
        {destDir ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  dir="ltr"
                  className="cursor-default truncate text-xs text-muted-foreground"
                />
              }
            >
              {destDir}
            </TooltipTrigger>
            <TooltipContent>{destDir}</TooltipContent>
          </Tooltip>
        ) : (
          <span dir="ltr" className="truncate text-xs text-muted-foreground">
            {t("settings.folders.default")}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Download log */}
      {logs.length > 0 && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{t("posters.done", { file: logs[0].file })}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setLogs([])}
            >
              <Trash2 className="mr-1 size-3" />
              {t("subkade.logClear")}
            </Button>
          </div>
        </div>
      )}

      {/* Results grid */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
        {searching &&
          [1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className="flex flex-col gap-1">
              <Skeleton className="aspect-2/3 w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
            </li>
          ))}
        {!searching &&
          results?.map((r) => {
            const isDownloading = downloading === r.id;
            const pct = progress[r.id];
            return (
              <li key={r.id} className="flex flex-col gap-1">
                <button
                  type="button"
                  className="group relative overflow-hidden rounded-lg border bg-accent/30 hover:bg-accent/60 disabled:opacity-50"
                  disabled={downloading !== null}
                  onClick={() => void handlePosterClick(r)}
                >
                  {r.posterUrl ? (
                    <img
                      src={r.posterUrl}
                      alt={r.title}
                      className="aspect-2/3 w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to placeholder icon if image fails to load or is blocked
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
                    className={`flex aspect-2/3 w-full flex-col items-center justify-center gap-1 bg-accent/20 text-muted-foreground ${r.posterUrl ? "hidden" : "flex"}`}
                  >
                    <FileImage className="size-8 opacity-50" />
                    <span className="text-[10px]">{t("posters.noPoster")}</span>
                  </div>
                  {isDownloading && (
                    <div className="absolute inset-x-0 bottom-0 bg-background/70 px-2 py-1 backdrop-blur-sm">
                      <p className="mb-1 text-center text-[10px] text-muted-foreground tabular-nums">
                        {pct === null
                          ? t("posters.downloadingUnknown")
                          : t("posters.downloading", { percent: pct })}
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
                  {r.year ? ` (${r.year})` : ""}
                  <span className="ml-1 text-muted-foreground/60">
                    {r.isTv ? t("posters.type.tv") : t("posters.type.movie")}
                  </span>
                </p>
              </li>
            );
          })}
        {results !== null && results.length === 0 && !searching && (
          <li className="col-span-full px-3 py-6 text-center text-xs text-muted-foreground">
            {t("posters.notFound")}
          </li>
        )}
        {results === null && !searching && (
          <li className="col-span-full px-3 py-10 text-center text-xs text-muted-foreground">
            {t("posters.hint")}
          </li>
        )}
      </ul>
    </PageShell>
  );
}
