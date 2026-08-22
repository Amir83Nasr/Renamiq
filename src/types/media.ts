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
export type OperationType = "rename" | "move" | "copy" | "delete";

export interface PlannedOperation {
  id: string;
  type: OperationType;
  source: string;
  destination: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  error: string | null;
}

export interface RenamePlan {
  id: string;
  root: string;
  operations: PlannedOperation[];
  createdAt: string;
}

export interface SubtitleMatch {
  videoPath: string;
  subtitlePath: string;
  language: string;
  confidence: number; // 0..100
  signals: string[];
}

export interface OperationRecord {
  id: string;
  kind: string;
  summary: string;
  itemCount: number;
  status: "completed" | "failed" | "partial";
  timestamp: string;
  canUndo: boolean;
}
