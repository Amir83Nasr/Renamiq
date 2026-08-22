import { Captions } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/i18n";
import { useAppStore } from "@/stores/app";

/** Subtitle overview: which videos have matched subtitles and their languages.
 *  Matching itself happens in the Rust planner; this page reports the result. */
export default function SubtitlesPage() {
  const { plan } = useAppStore();

  const subtitleOps = useMemo(
    () => plan?.ops.filter((op) => op.destination.match(/\.(srt|ass|ssa|sub|vtt)$/i)) ?? [],
    [plan],
  );

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-lg font-semibold">{t("nav.subtitles")}</h1>
        <p className="text-sm text-muted-foreground">
          External subtitles are matched to videos by name similarity and moved together with them.
        </p>
      </header>

      {!subtitleOps.length ? (
        <Card className="mx-auto mt-16 max-w-md border-dashed">
          <CardHeader className="items-center text-center">
            <Captions className="size-10 text-muted-foreground" />
            <CardTitle>No subtitles in the last scan</CardTitle>
            <CardDescription>
              Scan a folder containing .srt/.ass files next to your videos.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="divide-y divide-border rounded-lg border bg-card">
          {subtitleOps.map((op) => {
            const lang = op.destination.match(/\.([a-z]{2})\.(srt|ass|ssa|sub|vtt)$/i)?.[1] ?? "?";
            return (
              <li key={op.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Captions className="size-4 text-primary" />
                  {fileName(op.destination)}
                  <Badge variant="secondary">{lang.toUpperCase()}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{dirName(op.destination)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function fileName(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

function dirName(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : path;
}
