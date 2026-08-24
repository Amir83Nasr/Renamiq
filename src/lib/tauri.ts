/** Typed wrappers around Tauri commands. UI never calls invoke() raw. */
import { invoke } from "@tauri-apps/api/core";
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
