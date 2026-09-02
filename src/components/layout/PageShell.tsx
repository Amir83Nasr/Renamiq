// ── PAGE SHELL ──────────────────────────────────────────────────
// Standard page layout with consistent padding & gap.
// All pages use this to maintain visual rhythm.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageShellProps {
  children: ReactNode;
  className?: string;
  /** Default: "p-3" — consistent internal spacing */
  padding?: "none" | "sm" | "md" | "lg";
  /** Default: "gap-4" — vertical gap between sections */
  gap?: "sm" | "md" | "lg" | "none";
}

const paddingMap = {
  none: "",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
} as const;

const gapMap = {
  none: "",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
} as const;

export function PageShell({
  children,
  className,
  padding = "md",
  gap = "lg",
}: PageShellProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-y-auto",
        paddingMap[padding],
        gapMap[gap],
        className,
      )}
    >
      {children}
    </div>
  );
}
