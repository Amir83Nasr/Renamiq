// ── SUBKADE SUBTITLE DOWNLOAD PAGE ───────────────────────────

import { Captions, Download, FolderOpen, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";
import {
  pickFolder,
  type SubkadeResult,
  subkadeDownloadToFolder,
  subkadeSearch,
} from "@/lib/tauri";

/** "…/Mutiny.srt" → "Mutiny.srt". */
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Standalone sidebar page: search subkade.ir by name, download Persian
 *  subtitles into a chosen folder. No video file required. */
export default function SubkadePage() {
  const [query, setQuery] = useState("");
  const [destDir, setDestDir] = useState<string | null>(null);
  const [results, setResults] = useState<SubkadeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Formats a byte count as "51 KB"; 0/unknown hides the size. */
  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
    if (!destDir) return;
    setDownloading(r.url);
    setError(null);
    setDone(null);
    try {
      const { files, size } = await subkadeDownloadToFolder(r.url, destDir);
      if (files.length === 0) {
        setError(t("subkade.empty"));
      } else {
        const list = files.map((f) => nameOf(f)).join("\n");
        setDone(
          size
            ? `${list}\n${t("subkade.zipSize", { size: formatSize(size) })}`
            : list,
        );
      }
    } catch (err) {
      setError(String(err));
    }
    setDownloading(null);
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
      </form>

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
      {done && (
        <p className="text-xs text-success">
          {t("subkade.done", { files: done })}
        </p>
      )}

      <ul className="space-y-1">
        {results?.map((r) => (
          <li key={r.url}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-start text-xs hover:bg-accent/50 disabled:opacity-50"
              disabled={downloading !== null}
              title={destDir ? undefined : t("subkade.pickFolderFirst")}
              onClick={() => {
                if (!destDir) {
                  void pickFolder().then((dir) => {
                    if (dir) setDestDir(dir);
                  });
                  return;
                }
                void download(r);
              }}
            >
              {r.image ? (
                <img
                  src={r.image}
                  alt=""
                  loading="lazy"
                  className="h-14 w-10 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted">
                  <Captions className="size-5 text-muted-foreground" />
                </span>
              )}
              <span dir="ltr" className="min-w-0 flex-1 truncate font-medium">
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
