import { describe, expect, it } from "vitest";
import { statusCounts } from "@/stores/workspace";
import type { PlanItem } from "@/types/media";

function item(status: PlanItem["status"]): PlanItem {
  return {
    path: `/x/${status}.mkv`,
    originalName: `${status}.old.mkv`,
    newName: `${status}.mkv`,
    directory: "/x",
    destination: `/x/${status}.mkv`,
    kind: "movie",
    season: null,
    episode: null,
    year: 2020,
    status,
    warnings: [],
  };
}

describe("statusCounts", () => {
  it("counts each bucket", () => {
    const counts = statusCounts([
      item("ready"),
      item("ready"),
      item("needsreview"),
      item("conflict"),
      item("error"),
    ]);
    expect(counts).toEqual({
      ready: 2,
      needsReview: 1,
      conflict: 1,
      errors: 1,
    });
  });

  it("handles empty batch", () => {
    expect(statusCounts([])).toEqual({
      ready: 0,
      needsReview: 0,
      conflict: 0,
      errors: 0,
    });
  });
});
