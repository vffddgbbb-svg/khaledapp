import type { Grid } from "@/lib/schedule-import";
import { readGridFile } from "@/lib/import-validation";

export const MAX_SCHEDULE_FILE_BYTES = 2_000_000;
const MAX_XLSX_SHEETS = 20;
const MAX_XLSX_ROWS = 5_000;
const MAX_XLSX_COLUMNS = 100;
const MAX_PDF_PAGES = 100;

export type ScheduleFileSheet = {
  name: string;
  grid: Grid;
  source: "csv" | "html" | "xlsx" | "pdf";
};

type PdfItem = { str?: string; transform?: number[]; width?: number };

/** Turns PDF.js text items into approximate table rows using text coordinates. */
export function pdfTextItemsToGrid(items: PdfItem[]): Grid {
  const lines = new Map<number, { x: number; endX: number; text: string }[]>();
  for (const item of items) {
    const text = item.str?.replace(/\s+/g, " ").trim();
    const transform = item.transform;
    if (!text || !transform || transform.length < 6) continue;
    const x = Number(transform[4]);
    const y = Number(transform[5]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const lineKey = Math.round(y / 2) * 2;
    const line = lines.get(lineKey) ?? [];
    line.push({ x, endX: x + Math.max(0, Number(item.width) || 0), text });
    lines.set(lineKey, line);
  }

  return [...lines.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, line]) => {
      line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let previousEnd = Number.NEGATIVE_INFINITY;
      for (const item of line) {
        const gap = item.x - previousEnd;
        const separator = cells.length === 0 ? "" : gap >= 20 ? "    " : " ";
        cells.push(`${separator}${item.text}`);
        previousEnd = Math.max(previousEnd, item.endX);
      }
      return cells
        .join("")
        .trim()
        .split(/\s{2,}/)
        .map((cell) => cell.trim());
    })
    .filter((row) => row.some(Boolean));
}

async function readXlsx(buffer: ArrayBuffer): Promise<ScheduleFileSheet[]> {
  const XLSX = await import("xlsx");
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw new Error("محتوى الملف لا يطابق صيغة XLSX المتوقعة.");
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: false,
    sheetRows: MAX_XLSX_ROWS + 1,
    WTF: true,
  });
  if (workbook.SheetNames.length === 0) throw new Error("لا يحتوي ملف XLSX على أوراق عمل.");
  if (workbook.SheetNames.length > MAX_XLSX_SHEETS)
    throw new Error(`يتجاوز الملف الحد المسموح (${MAX_XLSX_SHEETS} أوراق عمل).`);

  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) throw new Error(`تعذر قراءة ورقة «${name}».`);
    const ref = sheet["!fullref"] ?? sheet["!ref"];
    if (!ref) return { name, grid: [], source: "xlsx" as const };
    const range = XLSX.utils.decode_range(ref);
    const rows = range.e.r - range.s.r + 1;
    const columns = range.e.c - range.s.c + 1;
    if (rows > MAX_XLSX_ROWS || columns > MAX_XLSX_COLUMNS || rows * columns > 100_000)
      throw new Error(
        `ورقة «${name}» تتجاوز الحد الآمن (${MAX_XLSX_ROWS} صف و${MAX_XLSX_COLUMNS} عمود).`,
      );
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    const grid = values.map((row) => row.map((value) => String(value ?? "")));
    return { name, grid, source: "xlsx" as const };
  });
}

async function readPdf(file: File): Promise<ScheduleFileSheet[]> {
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== "%PDF-") throw new Error("محتوى الملف لا يطابق صيغة PDF المتوقعة.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  if (document.numPages > MAX_PDF_PAGES) {
    await loadingTask.destroy();
    throw new Error(`يتجاوز PDF الحد المسموح (${MAX_PDF_PAGES} صفحة).`);
  }
  const pages: ScheduleFileSheet[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const grid = pdfTextItemsToGrid(content.items as PdfItem[]);
      if (grid.length) pages.push({ name: `صفحة ${pageNumber}`, grid, source: "pdf" });
    }
  } finally {
    await loadingTask.destroy();
  }
  if (!pages.length)
    throw new Error(
      "لم يُستخرج نص قابل للقراءة. الملفات المصوّرة/OCR غير مدعومة؛ لا تُنشأ صفوف تلقائيًا.",
    );
  return pages;
}

/** Parse only supported local files; raw files are never uploaded or persisted. */
export async function parseScheduleFile(file: File): Promise<ScheduleFileSheet[]> {
  if (file.size <= 0) throw new Error("الملف فارغ.");
  if (file.size > MAX_SCHEDULE_FILE_BYTES) throw new Error("الملف أكبر من 2 ميغابايت.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv"))
    return [{ name: "CSV", grid: readGridFile(await file.text(), false), source: "csv" }];
  if (name.endsWith(".html") || name.endsWith(".htm"))
    return [{ name: "HTML", grid: readGridFile(await file.text(), true), source: "html" }];
  if (name.endsWith(".xlsx")) return readXlsx(await file.arrayBuffer());
  if (name.endsWith(".pdf")) return readPdf(file);
  throw new Error("صيغة الملف غير مدعومة. استخدم CSV أو XLSX أو PDF نصيًا.");
}
