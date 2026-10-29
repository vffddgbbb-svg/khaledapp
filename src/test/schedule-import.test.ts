import { describe, expect, it } from "vitest";
import { buildAssignments, safeEqual } from "@/lib/schedule-import";

describe("schedule import", () => {
  it("reads members-as-rows grids and skips empty cells (no invented assignments)", () => {
    const grid = [
      ["الاسم", "1", "2", "٣"],
      ["أحمد", "ص", "", "م"],
      ["سارة", "", "ل", ""],
    ];
    const res = buildAssignments(grid, { layout: "members-rows", year: 2026, month: 11, headerRow: 0, labelCol: 0 });
    expect(res).toEqual([
      { date: "2026-11-01", assignee: "أحمد", code: "ص" },
      { date: "2026-11-03", assignee: "أحمد", code: "م" },
      { date: "2026-11-02", assignee: "سارة", code: "ل" },
    ]);
  });

  it("ignores days outside the chosen month", () => {
    const grid = [["", "31"], ["أحمد", "ص"]];
    expect(buildAssignments(grid, { layout: "members-rows", year: 2026, month: 2, headerRow: 0, labelCol: 0 })).toEqual([]);
  });
});

describe("setup token", () => {
  it("rejects empty and mismatched tokens", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
  });
});
