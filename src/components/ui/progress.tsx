// ── INLINE PROGRESS BAR (NATIVE <PROGRESS>, RESTYLED) ─────────

import { cn } from "@/lib/utils";

/** `value` of null means indeterminate — server didn't send a Content-Length. */
export function Progress({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  return (
    <progress
      max={100}
      value={value ?? undefined}
      className={cn(
        "h-1 w-full appearance-none overflow-hidden rounded-full bg-muted",
        // WebKit track + bar
        "[&::-webkit-progress-bar]:bg-muted",
        "[&::-webkit-progress-value]:bg-primary",
        // Firefox bar
        "[&::-moz-progress-bar]:bg-primary",
        // Indeterminate animation when no value
        value === null &&
          "animate-pulse [&::-webkit-progress-value]:bg-primary/60",
        className,
      )}
    />
  );
}
