/** Global app state: current scan, plan, and execution results. */
import { create } from "zustand";
import type { RenamePlan, ScanResult } from "@/types/media";

interface AppState {
  root: string | null;
  scan: ScanResult | null;
  plan: RenamePlan | null;
  scanning: boolean;
  planning: boolean;
  executing: boolean;
  error: string | null;
  organize: boolean;
  setRoot: (root: string | null) => void;
  setScan: (scan: ScanResult | null) => void;
  setPlan: (plan: RenamePlan | null) => void;
  setScanning: (v: boolean) => void;
  setPlanning: (v: boolean) => void;
  setExecuting: (v: boolean) => void;
  setError: (error: string | null) => void;
  setOrganize: (v: boolean) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  root: null,
  scan: null,
  plan: null,
  scanning: false,
  planning: false,
  executing: false,
  error: null,
  organize: true,
  setRoot: (root) => set({ root }),
  setScan: (scan) => set({ scan }),
  setPlan: (plan) => set({ plan }),
  setScanning: (scanning) => set({ scanning }),
  setPlanning: (planning) => set({ planning }),
  setExecuting: (executing) => set({ executing }),
  setError: (error) => set({ error }),
  setOrganize: (organize) => set({ organize }),
  reset: () =>
    set({
      root: null,
      scan: null,
      plan: null,
      scanning: false,
      planning: false,
      executing: false,
      error: null,
    }),
}));
