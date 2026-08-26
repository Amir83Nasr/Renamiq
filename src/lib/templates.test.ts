import { describe, expect, it } from "vitest";
import { renderTemplatePreview } from "@/lib/templates";

describe("renderTemplatePreview", () => {
  it("fills known vars", () => {
    expect(renderTemplatePreview("{title} {year}")).toBe("Obsession 2026");
  });

  it("pads season/episode like the backend", () => {
    expect(renderTemplatePreview("{title} S{season:02} E{episode:02}")).toBe(
      "Obsession S01 E01",
    );
  });

  it("keeps unknown vars visible", () => {
    expect(renderTemplatePreview("{title} {bogus}")).toBe("Obsession {bogus}");
  });

  it("fills new optional vars", () => {
    expect(renderTemplatePreview("{title} {group}")).toBe("Obsession NTb");
  });
});
