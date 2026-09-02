// ── SUBKADE SUBTITLE DOWNLOAD PAGE ───────────────────────────

import {
  CheckCircle2,
  FolderOpen,
  ImageOff,
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
  onSubkadeProgress,
  pickFolder,
  type SubkadeResult,
  subkadeDownloadToFolder,
  subkadeSearch,
  subkadeZipSize,
} from "@/lib/tauri";

/** "…/Mutiny.srt" → "Mutiny.srt". */
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;

interface LogEntry {
  id: string;
  title: string;
  files: string[];
  size: number;
  destDir: string;
  at: Date;
}

/** Standalone sidebar page: search subkade.ir by name, download Persian
 *  subtitles into a chosen folder (organized per title). No video file required. */
export default function SubkadePage() {
  const [query, setQuery] = useState("");
  const [destDir, setDestDir] = useState<string | null>(null);
  const [results, setResults] = useState<SubkadeResult[] | null>(null);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  // null = no progress yet (indeterminate); number = 0..100 when total known.
  const [progress, setProgress] = useState<Record<string, number | null>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Subscribe once; mark the active url's percent as bytes stream in.
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

  /** Formats a byte count as "51 KB"; 0/unknown hides the size. */
  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      const searchPromise = subkadeSearch(q);
      const res = await Promise.race([searchPromise, timeoutPromise]);
      if (controller.signal.aborted) return;

      setResults(res);
      setSizes({});
      void Promise.all(
        res.map(async (r) => {
          if (controller.signal.aborted) return;
          try {
            const sz = await subkadeZipSize(r.url);
            if (sz > 0 && !controller.signal.aborted) {
              setSizes((prev) => ({ ...prev, [r.url]: sz }));
            }
          } catch {}
        }),
      );
    } catch (err) {
      if (!controller.signal.aborted) setError(String(err));
    }
    if (!controller.signal.aborted) setSearching(false);
  };

  const startDownload = async (r: SubkadeResult, targetFolder: string) => {
    setDownloading(r.url);
    setProgress((prev) => ({ ...prev, [r.url]: null }));
    setError(null);
    try {
      const { files, size } = await subkadeDownloadToFolder(
        r.url,
        targetFolder,
        r.title,
      );
      if (files.length === 0) {
        setError(t("subkade.empty"));
      } else {
        setLogs((prev) => [
          {
            id: `${r.url}-${Date.now()}`,
            title: r.title,
            files: files.map(nameOf),
            size,
            destDir: targetFolder,
            at: new Date(),
          },
          ...prev,
        ]);
      }
    } catch (err) {
      setError(String(err));
    }
    setDownloading(null);
    setProgress((prev) => {
      const { [r.url]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleCardClick = async (r: SubkadeResult) => {
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
    setSizes({});
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
            placeholder={t("subkade.placeholder")}
          />
          <Button
            type="submit"
            size="sm"
            className="shrink-0"
            disabled={searching || !query.trim()}
          >
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            {t("subkade.search")}
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
          onClick={() => void pickFolder().then((d) => d && setDestDir(d))}
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

      {/* Download log / success cards */}
      {logs.length > 0 && (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{t("subkade.logTitle", { count: logs.length })}</span>
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
          <ul
            className="max-h-40 space-y-1.5 overflow-y-auto text-xs"
            dir="ltr"
          >
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2"
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="truncate">{log.title}</span>
                  {log.size > 0 && (
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {formatSize(log.size)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {log.files.map((f) => (
                    <div key={f} className="truncate">
                      • {f}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
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
            const isDownloading = downloading === r.url;
            const pct = progress[r.url];
            const knownSize = sizes[r.url];
            return (
              <li key={r.url} className="flex flex-col gap-1">
                <button
                  type="button"
                  className="group relative overflow-hidden rounded-lg border bg-accent/30 hover:bg-accent/60 disabled:opacity-50"
                  disabled={downloading !== null}
                  onClick={() => void handleCardClick(r)}
                >
                  {r.image ? (
                    <img
                      src={r.image}
                      alt={r.title}
                      className="aspect-2/3 w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to placeholder icon if image fails to load
                        // or is blocked
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
                    <ImageOff className="size-8 opacity-50" />
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
                  {knownSize ? (
                    <span className="ml-1 text-muted-foreground/60 tabular-nums">
                      {formatSize(knownSize)}
                    </span>
                  ) : null}
                </p>
              </li>
            );
          })}
        {results !== null && results.length === 0 && !searching && (
          <li className="col-span-full px-3 py-6 text-center text-xs text-muted-foreground">
            {t("subkade.notFound")}
          </li>
        )}
        {results === null && !searching && (
          <li className="col-span-full px-3 py-10 text-center text-xs text-muted-foreground">
            {t("subkade.hint")}
          </li>
        )}
      </ul>
    </PageShell>
  );
}
