import { describe, expect, it, beforeEach } from "vitest";
import { __resetIcsPreviewStoreForTests, consumeIcsPreview, createIcsPreview } from "./ics-preview-store";

describe("ICS preview store", () => {
  beforeEach(() => __resetIcsPreviewStoreForTests());

  it("isolates previews by user and consumes a preview once", () => {
    const candidates = [{ sourceUid: "event-a", blocks: [] }];
    const importId = createIcsPreview("user-a", "courses.ics", candidates);

    expect(consumeIcsPreview("user-b", importId)).toBeNull();
    expect(consumeIcsPreview("user-a", importId)).toEqual({ fileName: "courses.ics", candidates });
    expect(consumeIcsPreview("user-a", importId)).toBeNull();
  });
});
