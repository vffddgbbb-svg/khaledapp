// Pure helpers for importing an original schedule. Nothing here invents
// assignments: every output row comes from a non-empty cell in the source table,
// and every skipped cell is reported back to the user instead of dropped silently.

export type Grid = string[][];

const MAX_SPAN = 400;

/** Place cells into a rectangular grid honouring rowspan and colspan. */
export function placeCells(rows: { text: string; rowspan: number; colspan: number }[][]): Grid {
  const grid: Grid = [];
  rows.forEach((cells, r) => {
    grid[r] ??= [];
    let c = 0;
    for (const cell of cells) {
      while (grid[r]![c] !== undefined) c++;
      const rs = Math.max(1, Math.min(MAX_SPAN, cell.rowspan || 1));
      const cs = Math.max(1, Math.min(MAX_SPAN, cell.colspan || 1));
      for (let dr = 0; dr < rs && r + dr < rows.length; dr++) {
        const target = (grid[r + dr] ??= []);
        for (let dc = 0; dc < cs; dc++) target[c + dc] = cell.text;
      }
      c += cs;
    }
  });
  return grid.map((row) => Array.from(row, (v) => v ?? ""));
}

/** Extract all <table> elements from an HTML string as text grids (browser only). */
export function parseHtmlTables(html: string): Grid[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("table"))
    .map((table) =>
      placeCells(
        Array.from(table.querySelectorAll("tr"))
          .filter((tr) => tr.closest("table") === table)
          .map((tr) =>
            Array.from(tr.children)
              .filter((el) => el.tagName === "TD" || el.tagName === "TH")
              .map((cell) => ({
                text: (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
                rowspan: Number(cell.getAttribute("rowspan")) || 1,
                colspan: Number(cell.getAttribute("colspan")) || 1,
              })),
          ),
      ),
    )
    .filter((g) => g.length > 0);
}

export type Layout = "members-rows" | "dates-rows" | "dates-codes";

/** Splits a cell holding several names (one per line, or separated by Arabic/Latin commas). */
export function splitNames(cell: string) {
  return cell
    .split(/\r?\n|،|,/)
    .map((n) => n.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export interface ImportOptions {
  layout: Layout;
  year: number;
  month: number; // 1-12
  headerRow: number; // 0-based row holding day numbers / member names
  labelCol: number; // 0-based column holding member names / day numbers
}

export interface ImportedAssignment {
  date: string; // YYYY-MM-DD
  assignee: string;
  code: string;
  where?: string;
}

export interface SkippedCell {
  where: string;
  value: string;
  reason: string;
}

/** Converts Arabic-Indic (٠-٩) and Persian/Hindi (۰-۹) digits to ASCII. */
export function normalizeDigits(s: string) {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Reads a day label. Accepts exactly one number (optionally next to a weekday
 * name) or a full date in the chosen year/month. Anything else is rejected.
 */
export function parseDay(label: string, dim: number, year?: number, month?: number): number | null {
  const s = normalizeDigits(label).trim();
  const full = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (full) {
    if (year !== undefined && Number(full[1]) !== year) return null;
    if (month !== undefined && Number(full[2]) !== month) return null;
    const d = Number(full[3]);
    return d >= 1 && d <= dim ? d : null;
  }
  const nums = s.match(/\d+/g) ?? [];
  if (nums.length !== 1) return null;
  const d = Number(nums[0]);
  return d >= 1 && d <= dim ? d : null;
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const pos = (r: number, c: number) => `الصف ${r + 1}، العمود ${c + 1}`;

/** Turn a grid into assignments, reporting every skipped cell with its reason. */
export function readGrid(grid: Grid, o: ImportOptions) {
  if (!Number.isInteger(o.year) || o.year < 2000 || o.year > 2100)
    throw new Error("السنة غير صالحة.");
  if (!Number.isInteger(o.month) || o.month < 1 || o.month > 12) throw new Error("الشهر غير صالح.");
  const header = grid[o.headerRow];
  if (!header) throw new Error(`صف العناوين ${o.headerRow + 1} غير موجود في الجدول.`);
  const dim = daysInMonth(o.year, o.month);
  const rows: ImportedAssignment[] = [];
  const skipped: SkippedCell[] = [];
  const membersRows = o.layout === "members-rows";
  const colDays = new Map<number, number | null>();
  header.forEach((label, c) => {
    if (c === o.labelCol) return;
    const v = label.trim();
    if (!v) return;
    if (membersRows) {
      const d = parseDay(v, dim, o.year, o.month);
      colDays.set(c, d);
      if (d === null)
        skipped.push({
          where: pos(o.headerRow, c),
          value: v,
          reason: `عنوان يوم غير صالح لشهر فيه ${dim} يوماً`,
        });
    }
  });
  for (let r = o.headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const rowLabel = (row[o.labelCol] ?? "").trim();
    const filled = row.some((v, c) => c !== o.labelCol && v.trim());
    if (!rowLabel) {
      if (filled)
        skipped.push({
          where: pos(r, o.labelCol),
          value: "",
          reason: "صف بلا عنوان؛ تُجوهلت خلاياه",
        });
      continue;
    }
    const rowDay = membersRows ? null : parseDay(rowLabel, dim, o.year, o.month);
    if (!membersRows && rowDay === null) {
      if (rowLabel || filled)
        skipped.push({
          where: pos(r, o.labelCol),
          value: rowLabel,
          reason: `عنوان يوم غير صالح لشهر فيه ${dim} يوماً`,
        });
      continue;
    }
    for (let c = 0; c < row.length; c++) {
      if (c === o.labelCol) continue;
      const cell = (row[c] ?? "").trim();
      if (!cell) continue;
      const colLabel = (header[c] ?? "").trim();
      if (!colLabel) {
        skipped.push({ where: pos(r, c), value: cell, reason: "خلية تحت عمود بلا عنوان" });
        continue;
      }
      if (membersRows) {
        const day = colDays.get(c);
        if (!day) {
          skipped.push({ where: pos(r, c), value: cell, reason: "خلية تحت عنوان يوم غير صالح" });
          continue;
        }
        rows.push({
          date: iso(o.year, o.month, day),
          assignee: rowLabel,
          code: cell,
          where: pos(r, c),
        });
      } else if (o.layout === "dates-codes") {
        for (const name of splitNames(cell))
          rows.push({
            date: iso(o.year, o.month, rowDay!),
            assignee: name,
            code: colLabel,
            where: pos(r, c),
          });
      } else {
        rows.push({
          date: iso(o.year, o.month, rowDay!),
          assignee: colLabel,
          code: cell,
          where: pos(r, c),
        });
      }
    }
  }
  return { rows, skipped };
}

/** Backwards-compatible helper returning only the assignments. */
export function buildAssignments(grid: Grid, o: ImportOptions): ImportedAssignment[] {
  return readGrid(grid, o).rows;
}

/** Constant-time string comparison for setup tokens. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
