/** Workspace state: import → analyze → edit → plan → confirm → result. */

import { create } from "zustand";
import {
  buildRenamePlan,
  getSettings,
  scanFolder,
  scanPaths,
} from "@/lib/tauri";
import type {
  ConflictResolution,
  Destinations,
  FileOverride,
  PlanItem,
  PlanTemplates,
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
  /** Naming templates loaded from settings; null = backend defaults. */
  templates: PlanTemplates | null;
  /** Destination roots loaded from settings; null = backend defaults. */
  destinations: Destinations | null;
  selected: string | null;
  results: Map<string, boolean>;
  error: string | null;

  /** Load persisted settings (templates). Called once at app start. */
  loadSettings: () => Promise<void>;

  importPaths: (paths: string[], folderMode: boolean) => Promise<void>;
  /** Re-scan the current selection; keeps overrides and resolutions. */
  rescan: () => Promise<void>;
  /** Shared tail of every scan: filter media, flip to review, replan. */
  applyScan: (res: ScanResult) => void;
  setOrganize: (v: boolean) => void;
  setSelected: (path: string | null) => void;
  setOverride: (path: string, ovr: FileOverride) => void;
  clearOverride: (path: string) => void;
  setResolution: (path: string, r: ConflictResolution | null) => void;
  /** Set one resolution on every resolvable conflict in one replan. */
  applyResolutionToAll: (r: ConflictResolution | "clear") => void;
  clearAll: () => void;
  /** Rebuild the plan from current state. Debounced + race-guarded. */
  replan: () => void;
  /** Mark execution done; flips phase to result. */
  finishExecution: (results: Map<string, boolean>) => void;
}

let planGeneration = 0;

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
  templates: null,
  destinations: null,
  selected: null,
  results: new Map(),
  error: null,

  async loadSettings() {
    try {
      const s = await getSettings();
      const movie = s["templates.movie"];
      const tv = s["templates.tv"];
      if (movie || tv) {
        set({
          templates: {
            movie: movie || "{title} {year}",
            tv: tv || "{title} S{season:02} E{episode:02}",
          },
        });
      }
      const destMovie = s["folders.movie"]?.trim();
      const destTv = s["folders.tv"]?.trim();
      if (destMovie || destTv) {
        set({
          destinations: { movie: destMovie || "", tv: destTv || "" },
        });
      }
    } catch (err) {
      console.error(err);
    }
  },

  async importPaths(paths, folderMode) {
    if (paths.length === 0) return;
    set({ scanning: true, error: null });
    try {
      const res: ScanResult = await (folderMode
        ? scanFolder(paths[0])
        : scanPaths(paths));
      set({
        root: folderMode ? paths[0] : parentOf(paths[0]),
      });
      get().applyScan(res);
    } catch (err) {
      console.error(err);
      set({ error: String(err), scanning: false });
    }
  },

  async rescan() {
    const { files } = get();
    if (files.length === 0) return;
    // Re-scan the current selection, not root: loose imports would widen
    // scope to the whole parent folder. Stale overrides/resolutions for
    // vanished paths are harmless (planner lookups just miss).
    set({ scanning: true, error: null });
    try {
      const res: ScanResult = await scanPaths(files.map((f) => f.path));
      get().applyScan(res);
    } catch (err) {
      console.error(err);
      set({ error: String(err), scanning: false });
    }
  },

  /** Shared tail of every scan: filter media, flip to review, replan. */
  applyScan(res: ScanResult) {
    set({
      files: res.files.filter(
        (f) => f.role === "video" || f.role === "subtitle",
      ),
      phase: "review",
      scanning: false,
    });
    get().replan();
  },

  setOrganize(organize) {
    set({ organize });
    get().replan();
  },

  setSelected(selected) {
    set({ selected });
  },

  setOverride(path, ovr) {
    set((s) => ({
      overrides: { ...s.overrides, [path]: { ...s.overrides[path], ...ovr } },
    }));
    get().replan();
  },

  clearOverride(path) {
    set((s) => {
      const next = { ...s.overrides };
      delete next[path];
      return { overrides: next };
    });
    get().replan();
  },

  setResolution(path, resolution) {
    set((s) => {
      const next = { ...s.resolutions };
      if (resolution === null) delete next[path];
      else next[path] = resolution;
      return { resolutions: next };
    });
    get().replan();
  },

  applyResolutionToAll(resolution) {
    const { plan, resolutions } = get();
    const items = plan?.items ?? [];
    // Only on-disk collisions are resolvable; batch duplicates are not.
    const targets = items.filter(
      (item) =>
        (item.status === "conflict" && item.warnings.includes("exists")) ||
        (resolution !== "clear" && resolutions[item.path] !== undefined),
    );
    if (targets.length === 0) return;
    set((s) => {
      const next = { ...s.resolutions };
      for (const item of targets) {
        if (resolution === "clear") delete next[item.path];
        else next[item.path] = resolution;
      }
      return { resolutions: next };
    });
    get().replan();
  },

  clearAll() {
    planGeneration += 1; // invalidate in-flight plans
    set({
      phase: "import",
      root: null,
      files: [],
      plan: null,
      planning: false,
      overrides: {},
      resolutions: {},
      selected: null,
      results: new Map(),
      error: null,
    });
  },

  /** Debounced so fast typing fires one IPC, not one per keystroke.
   *  Generation counter discards stale responses arriving out of order. */
  replan() {
    const gen = ++planGeneration;
    const run = async () => {
      const {
        root,
        files,
        overrides,
        resolutions,
        organize,
        templates,
        destinations,
      } = get();
      if (!root || files.length === 0) {
        set({ plan: null });
        return;
      }
      try {
        const plan: RenamePlan = await buildRenamePlan({
          root,
          files,
          organize,
          templates,
          destinations,
          overrides,
          resolutions,
        });
        // Stale response? A newer replan started meanwhile — drop it.
        if (gen !== planGeneration) return;
        set({ plan, planning: false });
      } catch (err) {
        console.error(err);
        if (gen === planGeneration)
          set({ error: String(err), planning: false });
      }
    };
    set({ planning: true });
    setTimeout(() => void run(), PLAN_DEBOUNCE_MS);
  },

  finishExecution(results) {
    set({ results, phase: "result" });
  },
}));

const PLAN_DEBOUNCE_MS = 150;

function parentOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : path;
}

/** Derived counts for badges and confirmation dialog. */
export function statusCounts(items: PlanItem[]) {
  let ready = 0;
  let needsReview = 0;
  let conflict = 0;
  let errors = 0;
  for (const item of items) {
    if (item.status === "ready") ready += 1;
    else if (item.status === "needsreview") needsReview += 1;
    else if (item.status === "conflict") conflict += 1;
    else errors += 1;
  }
  return { ready, needsReview, conflict, errors };
}
