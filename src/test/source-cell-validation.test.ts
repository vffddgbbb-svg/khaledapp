// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  readDepartmentGrid,
  readGridFile,
  readFlat,
  assertNoSkippedCells,
} from "@/lib/import-validation";
import { readGrid, parseDay, placeCells } from "@/lib/schedule-import";

describe("nonempty source cells cannot disappear", () => {
  it.each([
    [
      ["التاريخ", "جناح", ""],
      ["2026-11-01", "اسم", "غير مفهوم"],
    ],
    [
      ["التاريخ", "جناح"],
      ["2026-11-01", "اسم", "غير مفهوم"],
    ],
    [
      ["التاريخ", "التاريخ", "جناح"],
      ["2026-11-01", "2026-11-02", "اسم"],
    ],
    [
      ["اليوم", "التاريخ", "جناح"],
      ["اسم في عمود اليوم", "2026-11-01", "اسم"],
    ],
    [
      ["اليوم", "التاريخ", "جناح"],
      ["الاثنين", "2026-11-01", "اسم"],
    ],
    [["مقدمة غير مستهلكة"], ["التاريخ", "جناح"], ["2026-11-01", "اسم"]],
    [
      ["التاريخ", "جناح"],
      ["2026-11-01", "،,"],
    ],
  ])("rejects malformed department input %#", (...grid) => {
    expect(() => readDepartmentGrid(grid, 2026, 11)).toThrow(/رُفض الملف كاملاً/);
  });
  it("rejects populated flat columns that are not consumed", () => {
    expect(() =>
      readFlat([
        ["date", "member", "code", ""],
        ["2026-11-01", "اسم", "D", "x"],
      ]),
    ).toThrow(/العمود 4/);
  });
  it("rejects arbitrary text around day numbers", () => {
    expect(parseDay("غير مفهوم 1", 30, 2026, 11)).toBeNull();
    expect(parseDay("الأحد ١", 30, 2026, 11)).toBe(1);
  });
  it("rejects nonempty pre-header grid content", () => {
    const result = readGrid([["عنوان"], ["الاسم", "1"], ["اسم", "D"]], {
      year: 2026,
      month: 11,
      headerRow: 1,
      labelCol: 0,
      layout: "members-rows",
    });
    expect(() => assertNoSkippedCells(result.skipped)).toThrow(/قبل صف العناوين/);
  });
  it("keeps HTML br/block/newline name boundaries", () => {
    const grid = readGridFile(
      "<table><tr><th>التاريخ</th><th>جناح</th></tr><tr><td>2026-11-01</td><td>أ<br>ب<div>ج</div><div>د</div>\nهـ</td></tr></table>",
      true,
    );
    // Explicit br and block boundaries must not concatenate names.
    expect(readDepartmentGrid(grid, 2026, 11).map((r) => r.name)).toEqual(["أ", "بج", "د", "هـ"]);
  });
  it("rejects overlapping merged cells without overwriting", () => {
    expect(() =>
      placeCells([
        [
          { text: "", rowspan: 1, colspan: 1 },
          { text: "reserved", rowspan: 2, colspan: 1 },
        ],
        [{ text: "collision", rowspan: 1, colspan: 2 }],
      ]),
    ).toThrow(/متداخلة/);
  });
  it("rejects unsupported spans rather than truncating", () => {
    expect(() => placeCells([[{ text: "x", rowspan: 2, colspan: 1 }]])).toThrow(/امتداد/);
    expect(() => placeCells([[{ text: "x", rowspan: 1, colspan: 401 }]])).toThrow(/امتداد/);
  });
});
