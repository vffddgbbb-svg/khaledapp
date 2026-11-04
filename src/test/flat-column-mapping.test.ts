import { describe, expect, it } from "vitest";
import { readFlatMapped, suggestFlatColumnMapping } from "@/lib/import-validation";

describe("explicit flat schedule column mapping", () => {
  it("suggests only exact recognized headers", () => {
    expect(suggestFlatColumnMapping([["date", "member", "code"]])).toEqual({
      date: 0,
      member: 1,
      code: 2,
    });
    expect(suggestFlatColumnMapping([["shift day", "doctor", "type"]])).toEqual({});
  });

  it("reads rows from manually selected columns, preserving source row locations", () => {
    const grid = [
      ["ملاحظة", "اسم الطبيب", "نوع", "تاريخ"],
      ["x", "Dr A", "N", "٢٠٢٦-١١-٠١"],
    ];
    expect(readFlatMapped(grid, { date: 3, member: 1, code: 2 })).toEqual([
      { date: "2026-11-01", assignee: "Dr A", code: "N", where: "السطر 2" },
    ]);
  });

  it("rejects repeated column assignment and invalid mapped rows", () => {
    const grid = [
      ["date", "member", "code"],
      ["not-a-date", "Dr A", "N"],
    ];
    expect(() => readFlatMapped(grid, { date: 0, member: 0, code: 2 })).toThrow("مختلف");
    expect(() => readFlatMapped(grid, { date: 0, member: 1, code: 2 })).toThrow("غير صالح");
  });
});
