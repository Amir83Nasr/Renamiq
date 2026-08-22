/** Typed wrappers around Tauri commands. UI never calls invoke() raw. */
import { invoke } from "@tauri-apps/api/core";
import type { OperationHistoryItem, RenamePlan, ScannedFile, ScanResult } from "@/types/media";

export async function scanFolder(path: string): Promise<ScanResult> {
  return invoke("scan_folder", { args: { path } });
}

export async function buildRenamePlan(scan: ScanResult, organize: boolean): Promise<RenamePlan> {
  const files = scan.files as unknown as ScannedFile[];
  return invoke("build_rename_plan", { args: { scan: { ...scan, files }, organize } });
}

export async function executeOperations(
  ops: RenamePlan["ops"],
  overwriteIds: string[],
): Promise<{ id: string; ok: boolean; error: string | null }[]> {
  return invoke("execute_operations", { ops, overwriteIds });
}

export async function listOperations(): Promise<OperationHistoryItem[]> {
  return invoke("list_operations");
}

export async function undoLastOperation(): Promise<string> {
  return invoke("undo_last_operation");
}

export async function pickFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}
