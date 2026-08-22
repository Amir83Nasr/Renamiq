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

/** A rename/move operation proposed by the planner. */
export type OperationType = "rename" | "move";

export interface PlannedOp {
  id: string;
  kind: OperationType;
  source: string;
  destination: string;
  /** Destination already exists on disk (needs user decision). */
  collidesOnDisk: boolean;
  /** Another planned op targets the same destination. */
  duplicateInPlan: boolean;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface RenamePlan {
  root: string;
  ops: PlannedOp[];
  skipped: SkippedFile[];
}

export interface OpResult {
  id: string;
  ok: boolean;
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
