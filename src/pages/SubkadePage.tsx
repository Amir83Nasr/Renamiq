// ── SUBKADE SUBTITLE DOWNLOAD PAGE ───────────────────────────

import {
  CheckCircle2,
  Download,
  FolderOpen,
  ImageOff,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-2">
      <form
        className="flex items-center gap-2"
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
              variant="ghost"
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

      {/* Results list */}
      <ul className="space-y-1">
        {searching && (
          <>
            {[1, 2, 3, 4].map((i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                <Skeleton className="h-14 w-10 shrink-0 rounded" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="size-4 shrink-0 rounded" />
              </li>
            ))}
          </>
        )}
        {!searching &&
          results?.map((r) => {
            const isDownloading = downloading === r.url;
            const pct = progress[r.url];
            const knownSize = sizes[r.url];
            return (
              <li key={r.url}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2 text-start text-xs hover:bg-accent/50 disabled:opacity-50"
                  disabled={downloading !== null}
                  onClick={() => void handleCardClick(r)}
                >
                  <span className="flex w-full items-center gap-3">
                    {r.image ? (
                      <img
                        src={r.image}
                        alt=""
                        loading="lazy"
                        className="h-14 w-10 shrink-0 rounded object-cover"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling?.classList.remove(
                            "hidden",
                          );
                        }}
                      />
                    ) : null}
                    <span
                      className={`flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted ${
                        r.image ? "hidden" : ""
                      }`}
                    >
                      <ImageOff className="size-5 text-muted-foreground" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span dir="ltr" className="truncate font-medium">
                        {r.title}
                      </span>
                      {knownSize ? (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatSize(knownSize)}
                        </span>
                      ) : null}
                    </span>
                    {isDownloading ? (
                      pct === null ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          {t("subkade.downloadingUnknown")}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          {t("subkade.downloading", { percent: pct })}
                        </span>
                      )
                    ) : (
                      <Download className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </span>
                  {isDownloading && <Progress value={pct} />}
                </button>
              </li>
            );
          })}
        {results !== null && results.length === 0 && !searching && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t("subkade.notFound")}
          </li>
        )}
        {results === null && !searching && (
          <li className="px-3 py-10 text-center text-xs text-muted-foreground">
            {t("subkade.hint")}
          </li>
        )}
      </ul>
    </div>
  );
}
