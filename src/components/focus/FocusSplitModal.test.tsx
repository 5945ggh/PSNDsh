import { describe, expect, it } from "vitest";
import { buildFocusSplitSegments } from "./FocusSplitModal";

describe("FocusSplitModal", () => {
  it("builds exact second-based boundaries for a non-minute duration", () => {
    const segments = buildFocusSplitSegments(
      [
        { id: "first", seconds: 60, entryId: "entry-a", note: "" },
        { id: "second", seconds: 30, entryId: "entry-b", note: "" },
      ],
      "2026-06-26T10:00:00.000Z",
      "2026-06-26T10:01:30.000Z",
    );

    expect(segments).toEqual([
      expect.objectContaining({
        id: "first",
        startedAt: "2026-06-26T10:00:00.000Z",
        endedAt: "2026-06-26T10:01:00.000Z",
      }),
      expect.objectContaining({
        id: "second",
        startedAt: "2026-06-26T10:01:00.000Z",
        endedAt: "2026-06-26T10:01:30.000Z",
      }),
    ]);
  });
});
