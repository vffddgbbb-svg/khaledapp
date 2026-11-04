// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseScheduleFile } from "@/lib/schedule-file-parser";

function makeTextPdf() {
  const stream =
    "BT /F1 12 Tf 10 80 Td (date) Tj 90 0 Td (member) Tj 0 -20 Td (2026-11-01) Tj 90 0 Td (Dr A) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++)
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe("PDF text import integration", () => {
  it("extracts a text PDF page into a preview grid locally", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ).href;
    const bytes = makeTextPdf();
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const file = {
      name: "schedule.pdf",
      size: bytes.length,
      arrayBuffer: async () => buffer,
      slice: (start = 0, end = bytes.length) => ({
        arrayBuffer: async () => buffer.slice(start, end),
      }),
    } as unknown as File;
    const pages = await parseScheduleFile(file);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.name).toBe("صفحة 1");
    expect(pages[0]?.grid.flat().join(" ")).toContain("2026-11-01");
    expect(pages[0]?.grid.flat().join(" ")).toContain("Dr A");
  });
});
