// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  normalizeDigits,
  parseHtmlTables,
  placeCells,
  readGrid,
} from "@/lib/schedule-import";
import {
  assertNoSkippedCells,
  findExisting,
  readGridFile,
  readSchedule,
  resolveSchedule,
} from "@/lib/import-validation";

const members = [
  { id: "a", full_name: "أحمد" },
  { id: "s", full_name: "سارة" },
];
const types = [
  { id: "tD", code: "D" },
  { id: "tN", code: "N" },
];
const opts = { year: 2026, month: 11, headerRow: 0, labelCol: 0 } as const;

describe("grid import", () => {
  it("reads doctors in rows, days in columns", () => {
    const { rows, skipped } = readGrid(
      [
        ["الاسم", "1", "2"],
        ["أحمد", "D", ""],
        ["سارة", "", "N"],
      ],
      { ...opts, layout: "members-rows" },
    );
    expect(rows.map(({ date, assignee, code }) => [date, assignee, code])).toEqual([
      ["2026-11-01", "أحمد", "D"],
      ["2026-11-02", "سارة", "N"],
    ]);
    expect(skipped).toEqual([]);
  });
  it("reads days in rows, doctors in columns", () => {
    const { rows } = readGrid(
      [
        ["اليوم", "أحمد", "سارة"],
        ["1", "D", "N"],
        ["2", "", "D"],
      ],
      { ...opts, layout: "dates-rows" },
    );
    expect(rows.map((r) => `${r.date}|${r.assignee}|${r.code}`)).toEqual([
      "2026-11-01|أحمد|D",
      "2026-11-01|سارة|N",
      "2026-11-02|سارة|D",
    ]);
  });
  it("reads Arabic-Indic and Persian digits", () => {
    expect(normalizeDigits("٣١ ۱۲")).toBe("31 12");
    const { rows } = readGrid(
      [
        ["", "الأحد ١٥", "۱۶"],
        ["أحمد", "D", "N"],
      ],
      { ...opts, layout: "members-rows" },
    );
    expect(rows.map((r) => r.date)).toEqual(["2026-11-15", "2026-11-16"]);
  });
  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [2026, 11, 30],
    [2026, 12, 31],
  ])("month %i-%i has %i days", (y, m, d) => {
    expect(daysInMonth(y, m)).toBe(d);
    const { rows, skipped } = readGrid(
      [
        ["", String(d), String(d + 1)],
        ["أحمد", "D", "D"],
      ],
      { year: y, month: m, headerRow: 0, labelCol: 0, layout: "members-rows" },
    );
    expect(rows).toHaveLength(1);
    expect(skipped.map((s) => s.value)).toEqual([String(d + 1), "D"]);
    expect(() => assertNoSkippedCells(skipped)).toThrow(/رُفض الملف كاملاً/);
  });
  it("reports invalid headers and orphan cells instead of dropping them silently", () => {
    const { rows, skipped } = readGrid(
      [
        ["", "1", "ملاحظات", ""],
        ["أحمد", "D", "x", "y"],
        ["", "N", "", ""],
      ],
      { ...opts, layout: "members-rows" },
    );
    expect(rows).toHaveLength(1);
    expect(skipped).toHaveLength(4);
    expect(() => assertNoSkippedCells(skipped)).toThrow(/رُفض الملف كاملاً/);
  });
  it("rejects non-empty cells under invalid day headers in both grid directions", () => {
    const membersRows = readGrid(
      [
        ["الاسم", "31", "1"],
        ["أحمد", "D", "N"],
      ],
      { year: 2026, month: 11, headerRow: 0, labelCol: 0, layout: "members-rows" },
    );
    const datesRows = readGrid(
      [
        ["اليوم", "أحمد"],
        ["31", "D"],
        ["1", "N"],
      ],
      { year: 2026, month: 11, headerRow: 0, labelCol: 0, layout: "dates-rows" },
    );
    const emptyInvalidDay = readGrid(
      [
        ["اليوم", "أحمد"],
        ["31", ""],
      ],
      { year: 2026, month: 11, headerRow: 0, labelCol: 0, layout: "dates-rows" },
    );
    expect(() => assertNoSkippedCells(membersRows.skipped)).toThrow(/عنوان يوم غير صالح/);
    expect(() => assertNoSkippedCells(datesRows.skipped)).toThrow(/عنوان يوم غير صالح/);
    expect(() => assertNoSkippedCells(emptyInvalidDay.skipped)).toThrow(/عنوان يوم غير صالح/);
  });
  it("allows genuinely empty cells in both grid directions", () => {
    const membersRows = readGrid(
      [
        ["الاسم", "1", "2"],
        ["أحمد", "D", ""],
      ],
      { ...opts, layout: "members-rows" },
    );
    const datesRows = readGrid(
      [
        ["اليوم", "أحمد"],
        ["1", "D"],
        ["2", ""],
      ],
      { ...opts, layout: "dates-rows" },
    );
    expect(() => assertNoSkippedCells(membersRows.skipped)).not.toThrow();
    expect(() => assertNoSkippedCells(datesRows.skipped)).not.toThrow();
  });
  it("expands rowspan and colspan into the right cells", () => {
    expect(
      placeCells([
        [
          { text: "الاسم", rowspan: 1, colspan: 1 },
          { text: "1", rowspan: 1, colspan: 1 },
          { text: "2", rowspan: 1, colspan: 1 },
        ],
        [
          { text: "أحمد", rowspan: 2, colspan: 1 },
          { text: "D", rowspan: 1, colspan: 2 },
        ],
        [
          { text: "N", rowspan: 1, colspan: 1 },
          { text: "", rowspan: 1, colspan: 1 },
        ],
      ]),
    ).toEqual([
      ["الاسم", "1", "2"],
      ["أحمد", "D", "D"],
      ["أحمد", "N", ""],
    ]);
    const html = `<table><tr><th>الاسم</th><th>1</th><th>2</th></tr><tr><td rowspan="2">أحمد</td><td colspan="2">D</td></tr><tr><td>N</td><td></td></tr></table>`;
    expect(parseHtmlTables(html)[0]).toEqual([
      ["الاسم", "1", "2"],
      ["أحمد", "D", "D"],
      ["أحمد", "N", ""],
    ]);
  });
});

describe("matching and duplicates", () => {
  it("rejects the whole file on an unknown name with its position", () => {
    expect(() =>
      resolveSchedule(
        [
          { date: "2026-11-01", assignee: "أحمد", code: "D" },
          { date: "2026-11-02", assignee: "خالد", code: "D", where: "الصف 3، العمود 2" },
        ],
        members,
        types,
      ),
    ).toThrow(/الصف 3، العمود 2.*خالد/s);
  });
  it("rejects an unknown shift code", () => {
    expect(() =>
      resolveSchedule([{ date: "2026-11-01", assignee: "أحمد", code: "X" }], members, types),
    ).toThrow(/X/);
  });
  it("rejects ambiguous names", () => {
    expect(() =>
      resolveSchedule(
        [{ date: "2026-11-01", assignee: "أحمد", code: "D" }],
        [...members, { id: "a2", full_name: "أحمد" }],
        types,
      ),
    ).toThrow(/أكثر من عضو/);
  });
  it("rejects duplicates inside the file", () => {
    const row = { date: "2026-11-01", assignee: "أحمد", code: "D" };
    expect(() => resolveSchedule([row, row], members, types)).toThrow(/مكرر/);
  });
  it("detects assignments already saved", () => {
    const resolved = resolveSchedule(
      [
        { date: "2026-11-01", assignee: "أحمد", code: "D" },
        { date: "2026-11-02", assignee: "أحمد", code: "D" },
      ],
      members,
      types,
    );
    expect(
      findExisting(resolved, [{ shift_date: "2026-11-02", member_id: "a", shift_type_id: "tD" }]),
    ).toEqual([{ date: "2026-11-02", memberId: "a", typeId: "tD" }]);
  });
});

describe("legacy flat formats", () => {
  it("still reads flat CSV", () => {
    expect(readSchedule("التاريخ,العضو,الرمز\n2026-11-01,أحمد,D", false)).toEqual([
      { date: "2026-11-01", assignee: "أحمد", code: "D", where: "السطر 2" },
    ]);
  });
  it("still reads flat HTML", () => {
    expect(
      readSchedule(
        "<table><tr><th>date</th><th>member</th><th>code</th></tr><tr><td>2026-11-01</td><td>سارة</td><td>N</td></tr></table>",
        true,
      ),
    ).toHaveLength(1);
  });
  it("rejects HTML with no table", () => {
    expect(() => readGridFile("<h1>مناوبات</h1>", true)).toThrow();
  });
});

describe("multi-line names per cell", () => {
  it("saves each name in a quoted multi-line CSV cell as its own shift", () => {
    const grid = readGridFile('اليوم,D,N\n1,"أحمد\nسارة",\n2,,"سارة"\n', false);
    const { rows, skipped } = readGrid(grid, { ...opts, layout: "dates-codes" });
    expect(skipped).toEqual([]);
    expect(rows.map(({ date, assignee, code }) => [date, assignee, code])).toEqual([
      ["2026-11-01", "أحمد", "D"],
      ["2026-11-01", "سارة", "D"],
      ["2026-11-02", "سارة", "N"],
    ]);
    expect(resolveSchedule(rows, members, types)).toHaveLength(3);
  });
  it("rejects the same name twice in one cell", () => {
    const grid = readGridFile('اليوم,D\n1,"أحمد\nأحمد"\n', false);
    const { rows } = readGrid(grid, { ...opts, layout: "dates-codes" });
    expect(() => resolveSchedule(rows, members, types)).toThrow();
  });
});

import { readDepartmentGrid } from "@/lib/import-validation";
describe("department grid", () => {
  const csv =
    'اليوم,التاريخ,جناح,عناية كبيرة\nالأحد,2026-11-01,"د. أحمد علي\nد. سارة محمد",خالد\nالاثنين,2026-11-02,,\n';
  it("keeps every full name per day and department, without needing profiles", () => {
    const rows = readDepartmentGrid(readGridFile(csv, false), 2026, 11);
    expect(rows.map((r) => [r.date, r.department, r.name])).toEqual([
      ["2026-11-01", "جناح", "د. أحمد علي"],
      ["2026-11-01", "جناح", "د. سارة محمد"],
      ["2026-11-01", "عناية كبيرة", "خالد"],
    ]);
  });
  it("rejects dates outside November 2026", () => {
    expect(() => readDepartmentGrid(readGridFile(csv, false), 2026, 12)).toThrow();
  });
  it("rejects a name repeated in the same cell", () => {
    expect(() =>
      readDepartmentGrid(readGridFile('التاريخ,جناح\n2026-11-01,"أ\nأ"', false), 2026, 11),
    ).toThrow();
  });
});

import { resolveFlatByCode, missingAfterSave } from "@/lib/import-validation";
import { fetchAllPages } from "@/lib/app-data";
import { vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("fixes: pagination, flat labels, department repeats, verification", () => {
  it("fetches every 1000-row page until the last short page", async () => {
    const total = 2345;
    const calls: [number, number][] = [];
    const rows = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return {
        data: Array.from(
          { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
          (_, i) => from + i,
        ),
        error: null,
      };
    });
    expect(rows).toHaveLength(2345);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
  it("flat CSV keeps unlinked full names and requires an existing code", () => {
    const rows = readSchedule("التاريخ,العضو,الرمز\n2026-11-01,د. خالد  عمر,D", false);
    expect(resolveFlatByCode(rows, types)).toEqual([
      { date: "2026-11-01", department: "D", name: "د. خالد عمر" },
    ]);
    expect(() =>
      resolveFlatByCode(readSchedule("التاريخ,العضو,الرمز\n2026-11-01,خالد,جديد", false), types),
    ).toThrow(/غير مسجل/);
  });
  it("allows a date repeated across rows but rejects the identical assignment", () => {
    const ok = readDepartmentGrid(
      readGridFile("التاريخ,جناح\n2026-11-01,أ\n2026-11-01,ب\n", false),
      2026,
      11,
    );
    expect(ok.map((r) => r.name)).toEqual(["أ", "ب"]);
    expect(() =>
      readDepartmentGrid(
        readGridFile("التاريخ,جناح\n2026-11-01,أ\n2026-11-01,أ\n", false),
        2026,
        11,
      ),
    ).toThrow(/مكرر/);
  });
  it("reports rows missing after save", () => {
    const expected = [
      { date: "2026-11-01", department: "D", name: "أ" },
      { date: "2026-11-01", department: "D", name: "ب" },
    ];
    const saved = [{ shift_date: "2026-11-01", assignee_label: "أ", shift_type_id: "tD" }];
    expect(missingAfterSave(expected, saved, types)).toEqual([expected[1]]);
  });
});
