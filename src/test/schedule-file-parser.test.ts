import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseScheduleFile, pdfTextItemsToGrid } from "@/lib/schedule-file-parser";

function fileFixture(name: string, bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return {
    name,
    size: bytes.byteLength,
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => buffer,
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => buffer.slice(start, end),
    }),
  } as unknown as File;
}

function textFixture(name: string, text: string) {
  return fileFixture(name, new TextEncoder().encode(text));
}

describe("schedule file parser", () => {
  it("parses CSV text as a grid without inventing rows", async () => {
    const result = await parseScheduleFile(
      textFixture("roster.csv", "date,member,code\n2026-11-01,Dr A,N"),
    );
    expect(result).toEqual([
      {
        name: "CSV",
        source: "csv",
        grid: [
          ["date", "member", "code"],
          ["2026-11-01", "Dr A", "N"],
        ],
      },
    ]);
  });

  it("reads every XLSX sheet for explicit user selection", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["date", "member", "code"],
        ["2026-11-01", "Dr A", "N"],
      ]),
      "November",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["date", "member", "code"]]),
      "December",
    );
    const result = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const bytes = result instanceof Uint8Array ? result : new Uint8Array(result);
    const sheets = await parseScheduleFile(fileFixture("roster.xlsx", bytes));
    expect(sheets.map((sheet) => sheet.name)).toEqual(["November", "December"]);
    expect(sheets[0]?.grid[1]).toEqual(["2026-11-01", "Dr A", "N"]);
  });

  it("splits PDF text items into approximate rows and aligned columns", () => {
    const grid = pdfTextItemsToGrid([
      { str: "date", transform: [1, 0, 0, 1, 10, 100], width: 20 },
      { str: "member", transform: [1, 0, 0, 1, 100, 100], width: 30 },
      { str: "2026-11-01", transform: [1, 0, 0, 1, 10, 80], width: 55 },
      { str: "Dr A", transform: [1, 0, 0, 1, 100, 80], width: 22 },
    ]);
    expect(grid).toEqual([
      ["date", "member"],
      ["2026-11-01", "Dr A"],
    ]);
  });

  it("rejects unsupported extension and oversized input", async () => {
    await expect(parseScheduleFile(textFixture("roster.xls", "x"))).rejects.toThrow("غير مدعومة");
    const oversized = fileFixture("roster.csv", new Uint8Array(2_000_001));
    await expect(parseScheduleFile(oversized)).rejects.toThrow("2 ميغابايت");
  });
});
