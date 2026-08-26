// ── POSTERS PAGE (TMDB POSTER SEARCH + DOWNLOAD) ──────────────

import { FolderOpen, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/i18n";
import {
  getSettings,
  pickFolder,
  TMDB_POSTER_URL,
  type TmdbResult,
  tmdbDownloadPoster,
  tmdbSearch,
} from "@/lib/tauri";

export default function PostersPage() {
  const [query, setQuery] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [destDir, setDestDir] = useState<string | null>(null);
  const [results, setResults] = useState<TmdbResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
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

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await tmdbSearch(q, apiKey));
    } catch (err) {
      setError(String(err));
    }
    setSearching(false);
  };

  const download = async (r: TmdbResult) => {
    if (!destDir) return;
    setDownloading(r.id);
    setError(null);
    setDone(null);
    try {
      const file = await tmdbDownloadPoster(r, apiKey, destDir);
      setDone(file);
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
          {t("posters.done", { file: done.split("/").pop() ?? done })}
        </p>
      )}

      {/* Results grid */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
        {results?.map((r) => (
          <li key={r.id} className="flex flex-col gap-1">
            <button
              type="button"
              className="group relative overflow-hidden rounded-lg border bg-accent/30 hover:bg-accent/60 disabled:opacity-50"
              disabled={downloading !== null || !destDir}
              title={destDir ? undefined : t("posters.pickFolderFirst")}
              onClick={() => void download(r)}
            >
              {r.posterPath ? (
                <img
                  src={TMDB_POSTER_URL(r.posterPath)}
                  alt={r.title}
                  className="aspect-2/3 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-2/3 w-full items-center justify-center text-xs text-muted-foreground">
                  No poster
                </div>
              )}
              {downloading === r.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="size-5 animate-spin" />
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
        ))}
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
    </div>
  );
}
