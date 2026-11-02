// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  normalizeDigits,
  parseHtmlTables,
  placeCells,
  readGrid,
} from "@/lib/schedule-import";
import { findExisting, readGridFile, readSchedule, resolveSchedule } from "@/lib/import-validation";

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
