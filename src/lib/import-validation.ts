import Papa from "papaparse";
import { parseHtmlTables, type Grid } from "@/lib/schedule-import";
export type ScheduleRow = { date: string; assignee: string; code: string };
export function readSchedule(text: string, html: boolean): ScheduleRow[] {
  let grid: Grid;
  if (html) {
    const tables = parseHtmlTables(text);
    if (tables.length !== 1)
      throw new Error(
        "يجب أن يحتوي HTML جدولاً واحداً. حوّل الجدول إلى أعمدة التاريخ والعضو ورمز المناوبة.",
      );
    grid = tables[0] ?? [];
  } else {
    const result = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" });
    if (result.errors.length) throw new Error("تعذر قراءة CSV. تحقق من الفواصل وعلامات الاقتباس.");
    grid = result.data;
  }
  const header = (grid[0] ?? []).map((s) =>
    s
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase(),
  );
  const columns = [
    header.findIndex((s) => ["date", "التاريخ"].includes(s)),
    header.findIndex((s) => ["member", "العضو", "الاسم"].includes(s)),
    header.findIndex((s) => ["code", "رمز المناوبة", "الرمز"].includes(s)),
  ];
  if (columns.some((i) => i < 0))
    throw new Error("الأعمدة المطلوبة: التاريخ (YYYY-MM-DD)، العضو، رمز المناوبة.");
  const aliases = [
    ["date", "التاريخ"],
    ["member", "العضو", "الاسم"],
    ["code", "رمز المناوبة", "الرمز"],
  ];
  if (aliases.some((names) => header.filter((name) => names.includes(name)).length !== 1))
    throw new Error("لا يجوز تكرار أعمدة التاريخ أو العضو أو الرمز.");
  if (grid.length <= 1) throw new Error("لا يحتوي الملف على مناوبات. الجدول الأصلي الكامل مطلوب.");
  if (grid.length > 2001) throw new Error("الحد الأقصى 2000 مناوبة في الملف الواحد.");
  return grid.slice(1).map((cells, index) => {
    const [date, assignee, code] = columns.map((i) => (cells[i] ?? "").trim());
    if (!date || !assignee || !code || !validDate(date))
      throw new Error(`السطر ${index + 2}: تاريخ أو اسم أو رمز غير صالح.`);
    return { date, assignee, code };
  });
}
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date;
}
export function resolveSchedule(
  rows: ScheduleRow[],
  members: { id: string; full_name: string }[],
  types: { id: string; code: string }[],
) {
  if (rows.length === 0 || rows.length > 2000)
    throw new Error("يجب أن يحتوي الملف على 1 إلى 2000 مناوبة.");
  const seen = new Set<string>();
  return rows.flatMap((row, index) => {
    const matches = members.filter((m) => m.full_name.trim() === row.assignee);
    const matchedTypes = types.filter((t) => t.code === row.code);
    const type = matchedTypes[0];
    if (matches.length !== 1 || matchedTypes.length !== 1 || !type || !validDate(row.date))
      throw new Error(
        `السطر ${index + 2}: يجب أن يطابق الاسم عضواً واحداً وأن يكون رمز المناوبة مسجلاً دون التباس.`,
      );
    const member = matches[0];
    if (!member) throw new Error("عضو غير موجود");
    const key = `${row.date}:${member.id}:${type.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ date: row.date, memberId: member.id, typeId: type.id }];
  });
}
