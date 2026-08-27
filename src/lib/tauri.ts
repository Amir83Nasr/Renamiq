/** Typed wrappers around Tauri commands. UI never calls invoke() raw. */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ConflictResolution,
  OperationHistoryItem,
  OpResult,
  PlanItem,
  PlanRequest,
  RenamePlan,
  ScanResult,
} from "@/types/media";

export async function scanFolder(path: string): Promise<ScanResult> {
  return invoke("scan_folder", { args: { path } });
}

export async function scanPaths(paths: string[]): Promise<ScanResult> {
  return invoke("scan_paths", { args: { paths } });
}

export async function buildRenamePlan(
  request: PlanRequest,
): Promise<RenamePlan> {
  return invoke("build_rename_plan", { args: request });
}

export async function executeOperations(
  items: PlanItem[],
  resolutions: Record<string, ConflictResolution>,
): Promise<OpResult[]> {
  return invoke("execute_operations", {
    items,
    resolutions: toPathKeyedMap(resolutions),
  });
}

export async function listOperations(): Promise<OperationHistoryItem[]> {
  return invoke("list_operations");
}

export async function undoLastOperation(): Promise<string> {
  return invoke("undo_last_operation");
}

export async function getSettings(): Promise<Record<string, string>> {
  return invoke("get_settings");
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

export interface SubkadeResult {
  postId: number;
  title: string;
  url: string;
  /** Poster thumbnail URL; empty when the card has none. */
  image: string;
}

export async function subkadeSearch(
  query: string,
  limit = 8,
): Promise<SubkadeResult[]> {
  return invoke("subkade_search", { query, limit });
}

/** Downloads the zip and extracts subtitles next to videoPath. */
export async function subkadeDownload(
  postUrl: string,
  videoPath: string,
): Promise<string[]> {
  return invoke("subkade_download", { postUrl, videoPath });
}

/** Standalone: downloads the zip, extracts subtitles into destDir (or
 *  destDir/subfolder if specified). Returns extracted paths and zip size. */
export async function subkadeDownloadToFolder(
  postUrl: string,
  destDir: string,
  subfolder?: string,
): Promise<{ files: string[]; size: number }> {
  const [files, size] = await invoke<[string[], number]>(
    "subkade_download_to_folder",
    { postUrl, destDir, subfolder: subfolder ?? null },
  );
  return { files, size };
}

/** Pre-fetches the zip size (in bytes) for a post URL. Returns 0 on error. */
export async function subkadeZipSize(postUrl: string): Promise<number> {
  try {
    return await invoke<number>("subkade_zip_size", { postUrl });
  } catch {
    return 0;
  }
}

/** Muxes subtitle into video via ffmpeg; returns the final video path. */
export async function embedSubtitle(
  video: string,
  subtitle: string,
  language?: string,
): Promise<string> {
  return invoke("embed_subtitle", { video, subtitle, language });
}

/** Removes all embedded subtitles from video via ffmpeg; returns the final video path. */
export async function removeSubtitle(video: string): Promise<string> {
  return invoke("remove_subtitle", { video });
}

export interface TmdbResult {
  id: number;
  title: string;
  year: number | null;
  isTv: boolean;
  posterUrl: string;
}

export async function tmdbSearch(
  query: string,
  apiKey: string,
  limit = 8,
): Promise<TmdbResult[]> {
  return invoke("tmdb_search", { query, apiKey, limit });
}

export async function tmdbDownloadPoster(
  result: TmdbResult,
  apiKey: string,
  destDir: string,
): Promise<string> {
  return invoke("tmdb_download_poster", { result, apiKey, destDir });
}

/** Progress payload emitted from Rust while a subkade zip streams. */
export interface SubkadeProgress {
  url: string;
  downloaded: number;
  total: number;
}

/** Progress payload emitted from Rust while a poster image streams. */
export interface PosterProgress {
  id: number;
  downloaded: number;
  total: number;
}

export function onSubkadeProgress(
  handler: (p: SubkadeProgress) => void,
): Promise<UnlistenFn> {
  return listen<SubkadeProgress>("subkade-progress", (e) => handler(e.payload));
}

export function onPosterProgress(
  handler: (p: PosterProgress) => void,
): Promise<UnlistenFn> {
  return listen<PosterProgress>("poster-progress", (e) => handler(e.payload));
}

/** Record keys are file paths; the Rust side expects a PathBuf-keyed map. */
function toPathKeyedMap(resolutions: Record<string, ConflictResolution>) {
  return resolutions;
}

export async function pickFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}

export async function pickFiles(): Promise<string[] | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: false,
    multiple: true,
    filters: [
      {
        name: "Media",
        extensions: ["mkv", "mp4", "avi", "mov", "webm", "m4v", "wmv", "ts"],
      },
    ],
  });
  if (Array.isArray(selected)) return selected;
  if (typeof selected === "string") return [selected];
  return null;
}
