// ── PAGE HEADER ─────────────────────────────────────────────────
// Consistent header for all pages: title + optional badge + actions.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Left-aligned content (title, badge, etc.) */
  left?: ReactNode;
  /** Right-aligned content (actions, buttons) */
  right?: ReactNode;
  /** Single child rendered between left and right (e.g. flexible filler) */
  children?: ReactNode;
  className?: string;
  /** Default: false — if true, removes bottom border */
  noBorder?: boolean;
}

export function PageHeader({
  left,
  right,
  children,
  className,
  noBorder = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-2 px-0 py-2",
        !noBorder && "border-b border-border/50",
        className,
      )}
    >
      {left && <div className="flex items-center gap-2 shrink-0">{left}</div>}
      {children && <div className="flex-1 min-w-0">{children}</div>}
      {right && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">{right}</div>
      )}
    </header>
  );
}
