// ── SUBTITLE EMBED PAGE ───────────────────────────────────────

import { Captions, FileVideo, Loader2, PackagePlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { t } from "@/i18n";
import { embedSubtitle, pickFiles } from "@/lib/tauri";

/** ISO 639-2 codes ffmpeg understands; "none" stores no language tag. */
const LANGUAGES = ["per", "eng", "ara", "none"] as const;

/** Standalone sidebar page: pick a video + a subtitle file, mux the
 *  subtitle into the video as a soft track via system ffmpeg. */
export default function EmbedPage() {
  const [video, setVideo] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("per");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickVideo = async () => {
    const picked = await pickFiles();
    if (picked?.length) setVideo(picked[0]);
  };

  const pickSubtitle = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: false,
      multiple: false,
      filters: [
        { name: "Subtitle", extensions: ["srt", "ass", "ssa", "vtt", "sub"] },
      ],
    });
    if (typeof selected === "string") setSubtitle(selected);
  };

  const embed = async () => {
    if (!video || !subtitle) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const out = await embedSubtitle(
        video,
        subtitle,
        language === "none" ? undefined : language,
      );
      setDone(out);
    } catch (err) {
      setError(String(err));
    }
    setBusy(false);
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-6">
      <header className="sticky top-0 z-10 -mx-6 flex items-center gap-2 bg-background px-6 pb-3 pt-1">
        <PackagePlus className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{t("embed.pageTitle")}</h2>
      </header>

      {/* Video picker */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void pickVideo()}>
          <FileVideo /> {t("embed.pickVideo")}
        </Button>
        <span dir="ltr" className="truncate text-xs text-muted-foreground">
          {video ?? t("embed.noneSelected")}
        </span>
      </div>

      {/* Subtitle picker */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void pickSubtitle()}>
          <Captions /> {t("embed.pickSubtitle")}
        </Button>
        <span dir="auto" className="truncate text-xs text-muted-foreground">
          {subtitle ?? t("embed.noneSelected")}
        </span>
      </div>

      {/* Language + run */}
      <div className="flex items-end gap-2">
        <div className="grid w-40 gap-1.5">
          <Label htmlFor="embed-lang">{t("subtitle.language")}</Label>
          <Select
            id="embed-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {t(`embed.lang.${code}` as never)}
              </option>
            ))}
          </Select>
        </div>
        <Button
          size="sm"
          disabled={busy || !video || !subtitle}
          onClick={() => void embed()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <PackagePlus />}
          {t("embed.run")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p dir="ltr" className="text-xs text-success">
          {t("embed.done", { file: done })}
        </p>
      )}

      {!done && !error && (
        <p className="px-3 py-10 text-center text-xs text-muted-foreground">
          {t("embed.hint")}
        </p>
      )}
    </div>
  );
}
