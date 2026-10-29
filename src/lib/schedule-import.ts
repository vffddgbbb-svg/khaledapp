// Pure helpers for importing an original HTML schedule. Nothing here invents
// assignments: every output row comes from a non-empty cell in the source table.

export type Grid = string[][];

/** Extract all <table> elements from an HTML string as text grids (browser only). */
export function parseHtmlTables(html: string): Grid[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("table"))
    .map((table) =>
      Array.from(table.querySelectorAll("tr")).map((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll("th,td").forEach((cell) => {
          const text = (cell.textContent ?? "").replace(/\s+/g, " ").trim();
          const span = Math.max(1, Math.min(31, Number(cell.getAttribute("colspan")) || 1));
          for (let i = 0; i < span; i++) cells.push(text);
        });
        return cells;
      }),
    )
    .filter((g) => g.length > 0);
}

export type Layout = "members-rows" | "dates-rows";

export interface ImportOptions {
  layout: Layout;
  year: number;
  month: number; // 1-12
  headerRow: number; // index of row holding day numbers / member names
  labelCol: number; // index of column holding member names / day numbers
}

export interface ImportedAssignment {
  date: string; // YYYY-MM-DD
  assignee: string;
  code: string;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function normalizeDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

export function parseDay(label: string, daysInMonth: number): number | null {
  const m = normalizeDigits(label).match(/\d{1,2}/);
  if (!m) return null;
  const d = Number(m[0]);
  return d >= 1 && d <= daysInMonth ? d : null;
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Turn a grid into assignments. Empty cells and unparseable day headers are skipped. */
export function buildAssignments(grid: Grid, o: ImportOptions): ImportedAssignment[] {
  const dim = new Date(o.year, o.month, 0).getDate();
  const out: ImportedAssignment[] = [];
  const header = grid[o.headerRow] ?? [];
  for (let r = o.headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    const rowLabel = (row[o.labelCol] ?? "").trim();
    if (!rowLabel) continue;
    for (let c = 0; c < row.length; c++) {
      if (c === o.labelCol) continue;
      const cell = (row[c] ?? "").trim();
      const colLabel = (header[c] ?? "").trim();
      if (!cell || !colLabel) continue;
      if (o.layout === "members-rows") {
        const day = parseDay(colLabel, dim);
        if (!day) continue;
        out.push({ date: iso(o.year, o.month, day), assignee: rowLabel, code: cell });
      } else {
        const day = parseDay(rowLabel, dim);
        if (!day) continue;
        out.push({ date: iso(o.year, o.month, day), assignee: colLabel, code: cell });
      }
    }
  }
  return out;
}

/** Constant-time string comparison for setup tokens. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
