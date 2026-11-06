import { describe, expect, it } from "vitest";
import { buildAssignments, parseDay, safeEqual } from "@/lib/schedule-import";

describe("schedule import", () => {
  it("reads members-as-rows grids and skips empty cells (no invented assignments)", () => {
    const grid = [
      ["الاسم", "1", "2", "٣"],
      ["أحمد", "ص", "", "م"],
      ["سارة", "", "ل", ""],
    ];
    const res = buildAssignments(grid, {
      layout: "members-rows",
      year: 2026,
      month: 11,
      headerRow: 0,
      labelCol: 0,
    });
    expect(res.map(({ where: _w, ...r }) => r)).toEqual([
      { date: "2026-11-01", assignee: "أحمد", code: "ص" },
      { date: "2026-11-03", assignee: "أحمد", code: "م" },
      { date: "2026-11-02", assignee: "سارة", code: "ل" },
    ]);
  });

  it("rejects the entire import for days outside the chosen month", () => {
    const grid = [
      ["", "31"],
      ["أحمد", "ص"],
    ];
    expect(() =>
      buildAssignments(grid, {
        layout: "members-rows",
        year: 2026,
        month: 2,
        headerRow: 0,
        labelCol: 0,
      }),
    ).toThrow(/رُفض الملف كاملاً/);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-00-01"])(
    "rejects an impossible full date %s even with a loose day limit",
    (label) => {
      expect(parseDay(label, 31)).toBeNull();
    },
  );

  it("accepts the leap day only in a leap year", () => {
    expect(parseDay("2028-02-29", 31)).toBe(29);
    expect(parseDay("2026-02-29", 31)).toBeNull();
  });
});

describe("setup token", () => {
  it("rejects empty and mismatched tokens", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
  });
});
