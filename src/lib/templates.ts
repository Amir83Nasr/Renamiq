// ── TEMPLATE PREVIEW (MIRROR OF RUST RENDERER) ───────────────

/**
 * Variables offered as chips in Settings. Mirrors the subset the Rust
 * renderer fills for video items (`rename::templates::variable_value`).
 */
export const TEMPLATE_VARS = [
  "title",
  "year",
  "season",
  "episode",
  "resolution",
  "codec",
  "group",
  "audio",
  "edition",
] as const;

// Representative values so previews read like real output.
const SAMPLE: Record<(typeof TEMPLATE_VARS)[number], string> = {
  title: "Obsession",
  year: "2026",
  season: "01",
  episode: "01",
  resolution: "1080p",
  codec: "x265",
  group: "NTb",
  audio: "DDP5.1",
  edition: "Extended",
};

/** Live preview; keeps unknown {vars} visible exactly like the backend. */
export function renderTemplatePreview(template: string): string {
  return template.replace(
    /\{(\w+?)(?::0?2)?\}/g,
    (raw, name: string) => SAMPLE[name as keyof typeof SAMPLE] ?? raw,
  );
}
