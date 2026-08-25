/** Shared domain types — mirrors Rust structs serialized via serde. */

export type MediaKind = "movie" | "tv" | "unknown";

export interface ParsedMedia {
  /** Original filename including extension. */
  filename: string;
  kind: MediaKind;
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  /** Multi-episode file, e.g. S01E01E02 → [1, 2]. */
  episodes: number[] | null;
  resolution: string | null;
  codec: string | null;
  audio: string | null;
  language: string | null;
  group: string | null;
  edition: string | null;
  /** True when title detection is uncertain. */
  lowConfidence: boolean;
}

export type FileRole = "video" | "subtitle" | "other";

export interface ScannedFile {
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  role: FileRole;
  parsed: ParsedMedia | null;
  /** Subtitle language code when role === "subtitle", e.g. "fa". */
  subtitleLanguage: string | null;
}

export interface ScanResult {
  root: string;
  files: ScannedFile[];
  durationMs: number;
}

/** Per-file status computed at plan time. */
export type ItemStatus = "ready" | "needsreview" | "error" | "conflict";

/** How the user resolves an on-disk destination collision. */
export type ConflictResolution = "skip" | "replace" | "suffix";

/** User override for one file; null fields fall back to parsed values. */
export interface FileOverride {
  kind?: MediaKind;
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
  /** Subtitle language code override (e.g. "fa"). */
  language?: string;
  customName?: string;
  exclude?: boolean;
}

/** One file in the rename plan. */
export interface PlanItem {
  path: string;
  originalName: string;
  newName: string;
  directory: string;
  destination: string;
  kind: MediaKind;
  season: number | null;
  episode: number | null;
  year: number | null;
  /** Canonical subtitle language when this item is a subtitle sidecar. */
  language: string | null;
  /** Path of the video this subtitle is attached to (same stem). */
  videoPath: string | null;
  status: ItemStatus;
  /** Machine-readable reason codes ("notitle", "noyear", "nosxe", "unsure",
   *  "empty", "notype", "exists", "duplicate", "replace"). */
  warnings: string[];
}

/** User-configurable naming templates (settings page). */
export interface PlanTemplates {
  movie: string;
  tv: string;
}

export interface PlanRequest {
  root: string;
  files: ScannedFile[];
  organize: boolean;
  templates?: PlanTemplates | null;
  includeSubtitles?: boolean;
  overrides: Record<string, FileOverride>;
  resolutions: Record<string, ConflictResolution>;
}

export interface RenamePlan {
  items: PlanItem[];
  readyCount: number;
}

export interface OpResult {
  path: string;
  ok: boolean;
  /** Actual destination on success (may differ after suffix resolution). */
  destination: string | null;
  error: string | null;
}

export interface OperationHistoryItem {
  id: number;
  kind: string;
  summary: string;
  status: string;
  createdAt: string;
  canUndo: boolean;
  itemCount: number;
}
