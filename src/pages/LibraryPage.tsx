import { Film, FolderOpen, RefreshCw, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { pickFolder, scanFolder } from "@/lib/tauri";
import { useAppStore } from "@/stores/app";
import type { ScannedFile } from "@/types/media";

export default function LibraryPage() {
  const {
    root,
    scan,
    scanning,
    organize,
    error,
    setRoot,
    setScan,
    setScanning,
    setError,
    setOrganize,
  } = useAppStore();

  const handlePick = async () => {
    setError(null);
    const folder = await pickFolder();
    if (!folder) return;
    setRoot(folder);
    setScan(null);
    await handleScan(folder);
  };

  const handleScan = async (folder?: string) => {
    const target = folder ?? root;
    if (!target) return;
    setScanning(true);
    setError(null);
    try {
      setScan(await scanFolder(target));
    } catch (err) {
      setError(String(err));
    } finally {
      setScanning(false);
    }
  };

  const videos = scan?.files.filter((f: ScannedFile) => f.role === "video") ?? [];

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("nav.library")}</h1>
          {root && <p className="text-sm text-muted-foreground">{root}</p>}
        </div>
        <div className="flex items-center gap-3">
          {scan && (
            // biome-ignore lint/a11y/noLabelWithoutControl: Switch renders button element
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Organize into folders
              <Switch checked={organize} onCheckedChange={setOrganize} />
            </label>
          )}
          {root && (
            <Button variant="outline" onClick={() => handleScan()} disabled={scanning}>
              <RefreshCw /> {scanning ? t("library.scanning") : "Rescan"}
            </Button>
          )}
          <Button onClick={handlePick} disabled={scanning}>
            <FolderOpen /> {t("library.pickFolder")}
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!scan && !scanning && <EmptyState onPick={handlePick} />}

      {scanning && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("library.scanning")}
        </div>
      )}

      {scan && (
        <>
          <div className="text-sm text-muted-foreground">
            {t("library.fileCount", { count: scan.files.length })} · scanned in{" "}
            {(scan.durationMs / 1000).toFixed(1)}s
          </div>
          <ScrollArea className="flex-1 rounded-lg border">
            <ul className="divide-y divide-border">
              {videos.map((f) => (
                <li key={f.path} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {f.parsed?.kind === "tv" ? (
                    <Tv className="size-4 shrink-0 text-primary" />
                  ) : (
                    <Film className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  {f.parsed && f.parsed.kind !== "unknown" && (
                    <Badge variant={f.parsed.lowConfidence ? "warning" : "secondary"}>
                      {f.parsed.kind === "tv"
                        ? `S${String(f.parsed.season ?? 0).padStart(2, "0")} E${String(f.parsed.episode ?? 0).padStart(2, "0")}`
                        : (f.parsed.year ?? "?")}
                    </Badge>
                  )}
                  {f.parsed?.resolution && <Badge variant="outline">{f.parsed.resolution}</Badge>}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <Card className="mx-auto mt-16 max-w-md border-dashed">
      <CardHeader className="items-center text-center">
        <FolderOpen className="size-10 text-muted-foreground" />
        <CardTitle>{t("library.empty.title")}</CardTitle>
        <CardDescription>{t("library.empty.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button onClick={onPick}>
          <FolderOpen /> {t("library.pickFolder")}
        </Button>
      </CardContent>
    </Card>
  );
}
