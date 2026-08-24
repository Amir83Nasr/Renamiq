/** Workspace state: import → analyze → edit → plan → confirm → result. */

import { create } from "zustand";
import { buildRenamePlan, scanFolder, scanPaths } from "@/lib/tauri";
import type {
  ConflictResolution,
  FileOverride,
  PlanItem,
  RenamePlan,
  ScannedFile,
  ScanResult,
} from "@/types/media";

type Phase = "import" | "review" | "result";

interface WorkspaceState {
  phase: Phase;
  root: string | null;
  files: ScannedFile[];
  scanning: boolean;
  plan: RenamePlan | null;
  planning: boolean;
  overrides: Record<string, FileOverride>;
  resolutions: Record<string, ConflictResolution>;
  organize: boolean;
  selected: string | null;
  results: Map<string, boolean>;
  error: string | null;

  importPaths: (paths: string[], folderMode: boolean) => Promise<void>;
  setOrganize: (v: boolean) => void;
  setSelected: (path: string | null) => void;
  setOverride: (path: string, ovr: FileOverride) => void;
  clearOverride: (path: string) => void;
  setResolution: (path: string, r: ConflictResolution | null) => void;
  clearAll: () => void;
  /** Rebuild the plan from current files + edits. */
  replan: () => Promise<void>;
  /** Mark execution done; flips phase to result. */
  finishExecution: (results: Map<string, boolean>) => void;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  phase: "import",
  root: null,
  files: [],
  scanning: false,
  plan: null,
  planning: false,
  overrides: {},
  resolutions: {},
  organize: false,
  selected: null,
  results: new Map(),
  error: null,

  async importPaths(paths, folderMode) {
    if (paths.length === 0) return;
    set({ scanning: true, error: null });
    try {
      const res: ScanResult = await (folderMode
        ? scanFolder(paths[0])
        : scanPaths(paths));
      set({
        root: folderMode ? paths[0] : parentOf(paths[0]),
        files: res.files.filter((f) => f.role === "video"),
        phase: "review",
        scanning: false,
      });
      await get().replan();
    } catch (err) {
      console.error(err);
      set({ error: String(err), scanning: false });
    }
  },

  setOrganize(organize) {
    set({ organize });
    void get().replan();
  },

  setSelected(selected) {
    set({ selected });
  },

  setOverride(path, ovr) {
    set((s) => ({
      overrides: { ...s.overrides, [path]: { ...s.overrides[path], ...ovr } },
    }));
    void get().replan();
  },

  clearOverride(path) {
    set((s) => {
      const next = { ...s.overrides };
      delete next[path];
      return { overrides: next };
    });
    void get().replan();
  },

  setResolution(path, resolution) {
    set((s) => {
      const next = { ...s.resolutions };
      if (resolution === null) delete next[path];
      else next[path] = resolution;
      return { resolutions: next };
    });
    void get().replan();
  },

  clearAll() {
    set({
      phase: "import",
      root: null,
      files: [],
      plan: null,
      overrides: {},
      resolutions: {},
      selected: null,
      results: new Map(),
      error: null,
    });
  },

  async replan() {
    const { root, files, overrides, resolutions, organize } = get();
    if (!root || files.length === 0) {
      set({ plan: null });
      return;
    }
    set({ planning: true });
    try {
      const plan: RenamePlan = await buildRenamePlan({
        root,
        files,
        organize,
        overrides,
        resolutions,
      });
      set({ plan, planning: false });
    } catch (err) {
      console.error(err);
      set({ error: String(err), planning: false });
    }
  },

  finishExecution(results) {
    set({ results, phase: "result" });
  },
}));

function parentOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : path;
}

/** Derived counts for badges and confirmation dialog. */
export function statusCounts(items: PlanItem[]) {
  const ready = items.filter((i) => i.status === "ready").length;
  const needsReview = items.filter((i) => i.status === "needsreview").length;
  const conflict = items.filter((i) => i.status === "conflict").length;
  const errors = items.filter((i) => i.status === "error").length;
  return { ready, needsReview, conflict, errors };
}
