// ── TITLEBAR COMPONENT ───────────────────────────────────────

/** Draggable top strip; shows the active section name centered over the
 *  content area (sidebar is fixed, so window-centering would look off). */
export function TitleBar({ label }: { label?: string }) {
  return (
    <div
      data-tauri-drag-region
      className="relative h-9 w-full shrink-0 select-none bg-background"
    >
      {label && (
        <span
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center text-xs font-semibold text-muted-foreground"
          // ponytail: +4px covers the 1-wide resize handle between sidebar and main
          style={{
            insetInlineStart: "calc(var(--sidebar-width, 0px) + 4px)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
