import Papa from "papaparse";
import {
  normalizeDigits,
  parseHtmlTables,
  type Grid,
  type SkippedCell,
} from "@/lib/schedule-import";
export type ScheduleRow = { date: string; assignee: string; code: string; where?: string };

/** Rejects a grid import if any non-empty cell or day label was not understood. */
export function assertNoSkippedCells(skipped: SkippedCell[]) {
  if (!skipped.length) return;
  const details = skipped
    .slice(0, 15)
    .map((cell) => `${cell.where}: ${cell.value ? `«${cell.value}» — ` : ""}${cell.reason}`)
    .join("\n");
  throw new Error(
    `رُفض الملف كاملاً ولم يُحفظ شيء (${skipped.length} خلية أو عنوان غير صالح):\n${details}${skipped.length > 15 ? "\n…" : ""}`,
  );
}

/** Reads a file into a single grid (HTML must contain exactly one table). */
export function readGridFile(text: string, html: boolean): Grid {
  if (html) {
    const tables = parseHtmlTables(text);
    if (tables.length !== 1)
      throw new Error("يجب أن يحتوي HTML جدولاً واحداً بالضبط يضم المناوبات.");
    return tables[0] ?? [];
  }
  const result = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" });
  if (result.errors.length) throw new Error("تعذر قراءة CSV. تحقق من الفواصل وعلامات الاقتباس.");
  return result.data;
}

/** Flat format: columns date, member, code. */
export function readSchedule(text: string, html: boolean): ScheduleRow[] {
  return readFlat(readGridFile(text, html));
}

export function readFlat(grid: Grid): ScheduleRow[] {
  const header = (grid[0] ?? []).map((s) =>
    s
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase(),
  );
  const aliases = [
    ["date", "التاريخ"],
    ["member", "العضو", "الاسم"],
    ["code", "رمز المناوبة", "الرمز"],
  ];
  const columns = aliases.map((names) => header.findIndex((s) => names.includes(s)));
  if (columns.some((i) => i < 0))
    throw new Error("الأعمدة المطلوبة: التاريخ (YYYY-MM-DD)، العضو، رمز المناوبة.");
  if (aliases.some((names) => header.filter((name) => names.includes(name)).length !== 1))
    throw new Error("لا يجوز تكرار أعمدة التاريخ أو العضو أو الرمز.");
  if (grid.length <= 1) throw new Error("لا يحتوي الملف على مناوبات. الجدول الأصلي الكامل مطلوب.");
  if (grid.length > 2001) throw new Error("الحد الأقصى 2000 مناوبة في الملف الواحد.");
  return grid.slice(1).map((cells, index) => {
    const [rawDate, assignee, code] = columns.map((i) => (cells[i] ?? "").trim());
    const date = normalizeDigits(rawDate ?? "");
    if (!date || !assignee || !code || !validDate(date))
      throw new Error(`السطر ${index + 2}: تاريخ أو اسم أو رمز غير صالح.`);
    return { date, assignee, code, where: `السطر ${index + 2}` };
  });
}

export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Exact matching only: every name must match one member and every code one
 * shift type. Any problem (unknown, ambiguous, duplicate) rejects the whole file.
 */
export function resolveSchedule(
  rows: ScheduleRow[],
  members: { id: string; full_name: string }[],
  types: { id: string; code: string }[],
) {
  if (rows.length === 0 || rows.length > 2000)
    throw new Error("يجب أن يحتوي الملف على 1 إلى 2000 مناوبة.");
  const errors: string[] = [];
  const seen = new Map<string, string>();
  const out: { date: string; memberId: string; typeId: string }[] = [];
  rows.forEach((row, index) => {
    const where = row.where ?? `السطر ${index + 2}`;
    const name = norm(row.assignee);
    const code = norm(row.code);
    const matches = members.filter((m) => norm(m.full_name) === name);
    const matchedTypes = types.filter((t) => norm(t.code) === code);
    if (!validDate(row.date)) errors.push(`${where}: تاريخ غير صالح «${row.date}».`);
    if (matches.length === 0) errors.push(`${where}: الاسم «${name}» غير موجود في الفريق.`);
    else if (matches.length > 1) errors.push(`${where}: الاسم «${name}» يطابق أكثر من عضو.`);
    if (matchedTypes.length === 0) errors.push(`${where}: رمز المناوبة «${code}» غير مسجل.`);
    else if (matchedTypes.length > 1) errors.push(`${where}: رمز المناوبة «${code}» ملتبس.`);
    const member = matches[0];
    const type = matchedTypes[0];
    if (matches.length !== 1 || matchedTypes.length !== 1 || !member || !type) return;
    const key = `${row.date}:${member.id}:${type.id}`;
    const first = seen.get(key);
    if (first) {
      errors.push(`${where}: مكرر مع ${first} (${name}، ${code}، ${row.date}).`);
      return;
    }
    seen.set(key, where);
    out.push({ date: row.date, memberId: member.id, typeId: type.id });
  });
  if (errors.length) {
    const shown = errors.slice(0, 15).join("\n");
    throw new Error(
      `رُفض الملف كاملاً ولم يُحفظ شيء (${errors.length} مشكلة):\n${shown}${errors.length > 15 ? "\n…" : ""}`,
    );
  }
  return out;
}

/** Rejects the file if any assignment already exists in the database. */
export function findExisting(
  resolved: { date: string; memberId: string; typeId: string }[],
  existing: { shift_date: string; member_id: string | null; shift_type_id: string | null }[],
) {
  const keys = new Set(existing.map((s) => `${s.shift_date}:${s.member_id}:${s.shift_type_id}`));
  return resolved.filter((r) => keys.has(`${r.date}:${r.memberId}:${r.typeId}`));
}

export type DepartmentRow = { date: string; department: string; name: string; where: string };

/**
 * Department grid: one row per day, a "التاريخ" column (YYYY-MM-DD) and one
 * column per department whose cells list full names, one per line.
 * Every date must fall inside the chosen month; any problem rejects the file.
 */
export function readDepartmentGrid(grid: Grid, year: number, month: number): DepartmentRow[] {
  const hIdx = grid.findIndex((r) => r.some((c) => c.replace(/^\uFEFF/, "").trim() === "التاريخ"));
  if (hIdx < 0) throw new Error("لم يُعثر على عمود «التاريخ» في صف العناوين.");
  const header = grid[hIdx]!.map((c) => c.replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim());
  const dateCol = header.indexOf("التاريخ");
  const skip = new Set(["التاريخ", "اليوم", ""]);
  const depts = header.map((h, i) => ({ h, i })).filter(({ h }) => !skip.has(h));
  if (!depts.length) throw new Error("لا توجد أعمدة أقسام بعد «اليوم» و«التاريخ».");
  if (new Set(depts.map((d) => d.h)).size !== depts.length) throw new Error("أسماء الأقسام مكررة في العناوين.");
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const out: DepartmentRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const dates = new Set<string>();
  grid.slice(hIdx + 1).forEach((row, k) => {
    const line = hIdx + k + 2;
    if (row.every((c) => !c.trim())) return;
    const date = normalizeDigits((row[dateCol] ?? "").trim());
    if (!validDate(date) || !date.startsWith(prefix)) {
      errors.push(`السطر ${line}: تاريخ «${date}» غير صالح أو خارج الشهر المختار.`);
      return;
    }
    if (dates.has(date)) errors.push(`السطر ${line}: التاريخ ${date} مكرر.`);
    dates.add(date);
    for (const { h, i } of depts) {
      for (const name of (row[i] ?? "").split(/\r?\n|،/).map((n) => n.replace(/\s+/g, " ").trim()).filter(Boolean)) {
        const key = `${date}|${h}|${name}`;
        if (seen.has(key)) errors.push(`السطر ${line}: «${name}» مكرر في ${h}.`);
        seen.add(key);
        out.push({ date, department: h, name, where: `السطر ${line}، ${h}` });
      }
    }
  });
  if (!errors.length && !out.length) errors.push("لا توجد أسماء في الملف.");
  if (out.length > 3000) errors.push("الحد الأقصى 3000 اسم في الملف.");
  if (errors.length)
    throw new Error(`رُفض الملف كاملاً ولم يُحفظ شيء (${errors.length} مشكلة):\n${errors.slice(0, 15).join("\n")}`);
  return out;
}
