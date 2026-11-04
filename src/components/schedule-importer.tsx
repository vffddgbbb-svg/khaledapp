import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/states";
import { FormSelect } from "@/components/form-select";
import {
  profilesQuery,
  shiftTypesQuery,
  errMsg,
  AR_MONTHS,
  monthRange,
  fetchShiftsRange,
} from "@/lib/app-data";
import {
  assertNoSkippedCells,
  findExisting,
  missingAfterSave,
  resolveFlatByCode,
  readFlatMapped,
  suggestFlatColumnMapping,
  type FlatColumnMapping,
  type LabelRow,
  readDepartmentGrid,
  resolveSchedule,
} from "@/lib/import-validation";
import { daysInMonth, readGrid, type Layout } from "@/lib/schedule-import";
import { supabase } from "@/integrations/supabase/client";
import { parseScheduleFile, type ScheduleFileSheet } from "@/lib/schedule-file-parser";
import { detectImportConflicts, type ImportConflict } from "@/lib/schedule-conflicts";

type Mode = "flat" | "departments" | Layout;

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function ScheduleImporter() {
  const profiles = useQuery(profilesQuery);
  const types = useQuery(shiftTypesQuery);
  const qc = useQueryClient();
  const now = new Date();
  const [sheets, setSheets] = useState<ScheduleFileSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const grid = sheets[sheetIndex]?.grid ?? null;
  const [mode, setMode] = useState<Mode>("departments");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [headerRow, setHeaderRow] = useState(1);
  const [labelCol, setLabelCol] = useState(1);
  const [flatMapping, setFlatMapping] = useState<Partial<FlatColumnMapping>>({});
  const [fileError, setFileError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [preflightError, setPreflightError] = useState("");
  const [preflightKey, setPreflightKey] = useState("");
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  const parsed = useMemo(() => {
    if (!grid) return null;
    if (mode === "departments") {
      try {
        const rows = readDepartmentGrid(grid, year, month).map((r) => ({
          date: r.date,
          assignee: r.name,
          code: r.department,
          where: r.where,
        }));
        return { rows, skipped: [], problem: "", error: "" };
      } catch (e) {
        return { rows: [], skipped: [], problem: "", error: errMsg(e) };
      }
    }
    try {
      const { rows, skipped } =
        mode === "flat"
          ? { rows: readFlatMapped(grid, flatMapping as FlatColumnMapping), skipped: [] }
          : readGrid(grid, {
              layout: mode,
              year,
              month,
              headerRow: headerRow - 1,
              labelCol: labelCol - 1,
            });
      let problem = "";
      try {
        if (mode !== "flat") assertNoSkippedCells(skipped);
        if (rows.length && mode === "flat") resolveFlatByCode(rows, types.data ?? []);
        else if (rows.length) resolveSchedule(rows, profiles.data ?? [], types.data ?? []);
        else problem = "لم يُعثر على أي مناوبة بهذه الإعدادات. راجع الاتجاه وصف/عمود العناوين.";
      } catch (e) {
        problem = errMsg(e);
      }
      return { rows, skipped, problem, error: "" };
    } catch (e) {
      return { rows: [], skipped: [], problem: "", error: errMsg(e) };
    }
  }, [grid, mode, year, month, headerRow, labelCol, flatMapping, profiles.data, types.data]);

  const planSignature =
    parsed && !parsed.error && parsed.rows.length
      ? JSON.stringify([mode, year, month, parsed.rows])
      : "";

  useEffect(() => {
    setPreflightKey("");
    setConflicts([]);
    setPreflightError("");
    setAcknowledgeWarnings(false);
  }, [planSignature]);

  async function checkExisting() {
    if (!parsed || !planSignature || parsed.error || parsed.problem) return;
    setChecking(true);
    setPreflightError("");
    setConflicts([]);
    setPreflightKey("");
    setAcknowledgeWarnings(false);
    try {
      const dates = parsed.rows.map((row) => row.date).sort();
      const first = shiftDate(dates[0]!, -1);
      const last = shiftDate(dates[dates.length - 1]!, 1);
      const existing = await fetchShiftsRange(first, last);
      setConflicts(
        detectImportConflicts(parsed.rows, profiles.data ?? [], types.data ?? [], existing),
      );
      setPreflightKey(planSignature);
    } catch (error) {
      setPreflightError(errMsg(error));
    } finally {
      setChecking(false);
    }
  }

  async function read(file?: File) {
    setSheets([]);
    setSheetIndex(0);
    setFlatMapping({});
    setFileError("");
    setSaveError("");
    setPreflightError("");
    setConflicts([]);
    setPreflightKey("");
    setAcknowledgeWarnings(false);
    setResult("");
    if (!file) return;
    try {
      const parsedSheets = await parseScheduleFile(file);
      setSheets(parsedSheets);
      setSheetIndex(0);
      setFlatMapping(suggestFlatColumnMapping(parsedSheets[0]?.grid ?? []));
    } catch (e) {
      setFileError(errMsg(e));
    }
  }

  function reset() {
    setSheets([]);
    setSheetIndex(0);
    setFlatMapping({});
    setConflicts([]);
    setPreflightKey("");
    setPreflightError("");
    setAcknowledgeWarnings(false);
    setFileKey((k) => k + 1);
  }

  function assertFreshConflicts(
    rows: { date: string; assignee: string; code: string; where?: string }[],
    existing: Awaited<ReturnType<typeof fetchShiftsRange>>,
    acknowledged: boolean,
  ) {
    const current = detectImportConflicts(rows, profiles.data ?? [], types.data ?? [], existing);
    const blocking = current.filter(
      (conflict) => conflict.kind === "duplicate" || conflict.kind === "overlap",
    );
    if (blocking.length)
      throw new Error(`أُوقف الحفظ بسبب ${blocking.length} تكرار/تداخل ظهر في الفحص الأخير.`);
    if (current.some((conflict) => conflict.kind === "unverified") && !acknowledged)
      throw new Error("أُوقف الحفظ: بقيت مناوبة قريبة بلا وقت موثق ولم يُسجّل إقرار المشرف.");
  }

  async function save() {
    if (!parsed || !planSignature || preflightKey !== planSignature) return;
    const blocking = conflicts.filter(
      (conflict) => conflict.kind === "duplicate" || conflict.kind === "overlap",
    );
    const unverified = conflicts.filter((conflict) => conflict.kind === "unverified");
    if (blocking.length) {
      setSaveError("تعذر الحفظ: عالج التكرار أو التداخل الظاهر في نتائج الفحص أولاً.");
      return;
    }
    if (unverified.length && !acknowledgeWarnings) {
      setSaveError("توجد مناوبات بأوقات غير محددة. راجعها وأقرّ صراحةً قبل المتابعة.");
      return;
    }
    setBusy(true);
    setSaveError("");
    try {
      if (mode === "departments" || mode === "flat") {
        const payload: LabelRow[] =
          mode === "flat"
            ? resolveFlatByCode(parsed.rows, types.data ?? [])
            : parsed.rows.map((r) => ({ date: r.date, department: r.code, name: r.assignee }));
        const dates = payload.map((r) => r.date).sort();
        const first = dates[0]!;
        const last = dates[dates.length - 1]!;
        const before = await fetchShiftsRange(shiftDate(first, -1), shiftDate(last, 1));
        assertFreshConflicts(parsed.rows, before, acknowledgeWarnings);
        const already = payload.length - missingAfterSave(payload, before, types.data ?? []).length;
        if (already)
          throw new Error(
            `رُفض الملف كاملاً: ${already} مناوبة مسجلة مسبقاً بنفس التاريخ والقسم والاسم.`,
          );
        const { data, error } = await supabase.rpc("import_department_schedule", {
          _rows: payload,
        });
        if (error) throw error;
        await qc.invalidateQueries({ queryKey: ["shift_types"] });
        const freshTypes = await qc.fetchQuery(shiftTypesQuery);
        const after = await fetchShiftsRange(first, last);
        const missing = missingAfterSave(payload, after, freshTypes);
        if (
          data !== payload.length ||
          missing.length ||
          after.length - before.length !== payload.length
        )
          throw new Error(
            `تعذر تأكيد الحفظ: المتوقع ${payload.length}، أبلغ الخادم ${data}، وزاد العدد المقروء ${after.length - before.length}، والمفقود ${missing.length}. راجع الجدول قبل إعادة المحاولة.`,
          );
        setResult(`حُفظت ${payload.length} مناوبة وتم التحقق منها بعد القراءة من قاعدة البيانات.`);
        reset();
        await Promise.all(
          ["shifts", "swap-shifts", "my-upcoming", "audit"].map((key) =>
            qc.invalidateQueries({ queryKey: [key] }),
          ),
        );
        return;
      }
      const resolved = resolveSchedule(parsed.rows, profiles.data ?? [], types.data ?? []);
      const dates = resolved.map((r) => r.date).sort();
      const existing = await fetchShiftsRange(
        shiftDate(dates[0]!, -1),
        shiftDate(dates[dates.length - 1]!, 1),
      );
      assertFreshConflicts(parsed.rows, existing, acknowledgeWarnings);
      const dup = findExisting(resolved, existing);
      if (dup.length) {
        const name = (id: string) => profiles.data?.find((p) => p.id === id)?.full_name ?? "";
        throw new Error(
          `رُفض الملف كاملاً: ${dup.length} مناوبة مسجلة مسبقاً، مثل ${dup
            .slice(0, 5)
            .map((d) => `${name(d.memberId)} ${d.date}`)
            .join("، ")}.`,
        );
      }
      const { data, error } = await supabase.rpc("import_schedule", { _rows: resolved });
      if (error) throw error;
      const saved = await fetchShiftsRange(dates[0]!, dates[dates.length - 1]!);
      const savedDup = findExisting(resolved, saved);
      if (data !== resolved.length || savedDup.length !== resolved.length)
        throw new Error(
          `تعذر تأكيد الحفظ: المتوقع ${resolved.length}، أبلغ الخادم ${data}، ووُجد بعد القراءة ${savedDup.length}.`,
        );
      setResult(`حُفظت ${data} مناوبة وتم التحقق منها بعد القراءة من قاعدة البيانات.`);
      reset();
      await Promise.all(
        ["shifts", "swap-shifts", "my-upcoming", "audit"].map((key) =>
          qc.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      setSaveError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const rowCount = grid?.length ?? 0;
  const colCount = Math.max(0, ...(grid ?? []).map((r) => r.length));
  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 2 + i);
  const canSave = parsed && !parsed.error && !parsed.problem && parsed.rows.length > 0;
  const { start } = monthRange(year, month);

  return (
    <section className="space-y-4 border-t py-6">
      <h2 className="text-xl font-bold">استيراد الجدول الأصلي</h2>
      <p className="text-sm text-muted-foreground">
        CSV أو XLSX أو PDF نصي أو HTML. صيغة الأقسام: أعمدة اليوم والتاريخ (YYYY-MM-DD) ثم عمود لكل
        قسم، وكل اسم في سطر داخل الخلية؛ تُحفظ الأسماء كاملة حتى لو لم يكن لها حساب، ويُنشأ القسم
        تلقائياً. يدعم أيضاً الجدول الشبكي (الأسماء في الصفوف والأيام في الأعمدة أو العكس) والصيغة
        المسطحة (التاريخ، العضو، رمز المناوبة) وفيها يُحفظ الاسم كاملاً حتى بلا حساب، لكن يجب أن
        يكون الرمز مسجلاً مسبقاً. في الصيغ الشبكية يجب أن تطابق الأسماء والرموز الفريق المسجل
        حرفياً؛ أي خطأ يرفض الملف كاملاً. PDF المصوّر/OCR غير مدعوم. التحليل محلي في المتصفح، والحد
        الأقصى للملف 2 ميغابايت.
      </p>
      <div className="space-y-2">
        <Label htmlFor="schedule-file">ملف الجدول</Label>
        <Input
          key={fileKey}
          id="schedule-file"
          type="file"
          accept=".csv,.xlsx,.pdf,.html,.htm"
          disabled={busy || profiles.isPending || types.isPending}
          onChange={(e) => read(e.target.files?.[0])}
        />
      </div>
      {sheets.length > 1 && (
        <div className="max-w-md space-y-1">
          <Label htmlFor="import-sheet">ورقة العمل / صفحة PDF</Label>
          <FormSelect
            id="import-sheet"
            value={sheetIndex}
            onChange={(event) => {
              const nextIndex = Number(event.target.value);
              setSheetIndex(nextIndex);
              setFlatMapping(suggestFlatColumnMapping(sheets[nextIndex]?.grid ?? []));
              setAcknowledgeWarnings(false);
            }}
          >
            {sheets.map((sheet, index) => (
              <option key={`${sheet.name}-${index}`} value={index}>
                {sheet.name}
              </option>
            ))}
          </FormSelect>
        </div>
      )}
      {fileError && <ErrorState message={fileError} />}
      {result && (
        <p role="status" className="text-sm text-success">
          {result}
        </p>
      )}
      {grid && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            المصدر: {sheets[sheetIndex]?.name ?? "—"} · {rowCount} صف × {colCount} عمود.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="imp-mode">شكل الجدول</Label>
              <FormSelect
                id="imp-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                <option value="departments">
                  أقسام: اليوم، التاريخ، ثم عمود لكل قسم (أسماء متعددة في الخلية)
                </option>
                <option value="members-rows">شبكي: الأطباء في الصفوف والأيام في الأعمدة</option>
                <option value="dates-rows">شبكي: الأيام في الصفوف والأطباء في الأعمدة</option>
                <option value="dates-codes">
                  شبكي: الأيام في الصفوف ورموز المناوبات في الأعمدة (عدة أسماء في الخلية، اسم في كل
                  سطر)
                </option>
                <option value="flat">مسطح: أعمدة التاريخ والعضو والرمز</option>
              </FormSelect>
            </div>
            {mode === "flat" && (
              <div className="grid gap-3 sm:col-span-2 lg:col-span-3 sm:grid-cols-3">
                {(
                  [
                    ["date", "عمود التاريخ"],
                    ["member", "عمود العضو / الاسم"],
                    ["code", "عمود رمز المناوبة"],
                  ] as const
                ).map(([field, label]) => (
                  <div className="space-y-1" key={field}>
                    <Label htmlFor={`flat-${field}`}>{label}</Label>
                    <FormSelect
                      id={`flat-${field}`}
                      value={flatMapping[field] ?? ""}
                      onChange={(event) => {
                        const next = { ...flatMapping };
                        if (event.target.value === "") delete next[field];
                        else next[field] = Number(event.target.value);
                        setFlatMapping(next);
                        setAcknowledgeWarnings(false);
                      }}
                    >
                      <option value="">اختر العمود…</option>
                      {Array.from({ length: colCount }, (_, column) => (
                        <option key={column} value={column}>
                          {column + 1}. {grid?.[0]?.[column] || "(بلا عنوان)"}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                ))}
              </div>
            )}
            {mode !== "flat" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="imp-year">السنة</Label>
                  <FormSelect
                    id="imp-year"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </FormSelect>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imp-month">الشهر</Label>
                  <FormSelect
                    id="imp-month"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {AR_MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m} ({daysInMonth(year, i + 1)} يوماً)
                      </option>
                    ))}
                  </FormSelect>
                </div>
                {mode !== "departments" && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="imp-header">
                        رقم صف العناوين (
                        {mode === "members-rows"
                          ? "الأيام"
                          : mode === "dates-codes"
                            ? "رموز المناوبات"
                            : "الأسماء"}
                        )
                      </Label>
                      <Input
                        id="imp-header"
                        type="number"
                        min={1}
                        max={rowCount}
                        value={headerRow}
                        onChange={(e) =>
                          setHeaderRow(Math.max(1, Math.min(rowCount, Number(e.target.value) || 1)))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="imp-col">
                        رقم عمود العناوين ({mode === "members-rows" ? "الأسماء" : "الأيام"})
                      </Label>
                      <Input
                        id="imp-col"
                        type="number"
                        min={1}
                        max={colCount}
                        value={labelCol}
                        onChange={(e) =>
                          setLabelCol(Math.max(1, Math.min(colCount, Number(e.target.value) || 1)))
                        }
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {mode !== "flat" && mode !== "departments" && (
            <>
              <h3 className="font-semibold">
                الصفوف الأولى من الملف (للتأكد من أرقام الصف والعمود)
              </h3>
              <div className="max-h-56 overflow-auto rounded-lg border">
                <table className="text-right text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2">#</th>
                      {Array.from({ length: Math.min(colCount, 35) }, (_, c) => (
                        <th key={c} className={`p-2 ${c === labelCol - 1 ? "bg-primary/15" : ""}`}>
                          {c + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.slice(0, 8).map((row, r) => (
                      <tr
                        key={r}
                        className={`border-t ${r === headerRow - 1 ? "bg-primary/15 font-semibold" : ""}`}
                      >
                        <th className="p-2">{r + 1}</th>
                        {Array.from({ length: Math.min(colCount, 35) }, (_, c) => (
                          <td key={c} className="whitespace-nowrap p-2">
                            {row[c] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                الشهر المختار يبدأ في <span dir="ltr">{start}</span>.
              </p>
            </>
          )}
          {parsed?.error && <ErrorState message={parsed.error} />}
          {parsed && parsed.skipped.length > 0 && (
            <details className="rounded-lg border p-3 text-sm" open>
              <summary className="cursor-pointer font-semibold">
                خلايا تُجوهلت ({parsed.skipped.length}) — لن تُحفظ
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {parsed.skipped.map((s, i) => (
                  <li key={i}>
                    {s.where}: {s.value ? `«${s.value}» — ` : ""}
                    {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {parsed?.problem && (
            <div className="whitespace-pre-line">
              <ErrorState message={parsed.problem} />
            </div>
          )}
          {saveError && (
            <div className="whitespace-pre-line">
              <ErrorState message={saveError} />
            </div>
          )}
          {preflightError && <ErrorState message={`فشل الفحص الجاف: ${preflightError}`} />}
          {preflightKey === planSignature && (
            <section className="space-y-2 rounded-lg border p-3" aria-live="polite">
              <h3 className="font-semibold">نتائج فحص التكرار والتعارض (قراءة فقط)</h3>
              {conflicts.length === 0 ? (
                <p className="text-sm text-success">
                  لم يُعثر على تكرار أو تداخل مع المناوبات المقروءة.
                </p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                  {conflicts.map((conflict, index) => (
                    <li
                      key={`${conflict.kind}-${conflict.location}-${index}`}
                      className={
                        conflict.kind === "unverified" ? "text-amber-700" : "text-destructive"
                      }
                    >
                      {conflict.location}: {conflict.message}
                    </li>
                  ))}
                </ul>
              )}
              {conflicts.some((conflict) => conflict.kind === "unverified") && (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={acknowledgeWarnings}
                    onCheckedChange={(checked) => setAcknowledgeWarnings(checked === true)}
                    aria-label="أقر بمراجعة المناوبات ذات الأوقات غير المحددة"
                  />
                  <span>
                    راجعت التحذيرات التي لا يمكن حسمها لغياب وقت المناوبة، وأوافق على المتابعة.
                  </span>
                </label>
              )}
            </section>
          )}
          {parsed && parsed.rows.length > 0 && (
            <>
              <h3 className="font-semibold">
                معاينة كاملة قبل الحفظ — {parsed.rows.length} مناوبة
              </h3>
              <div className="max-h-80 overflow-auto rounded-lg border">
                <table className="w-full text-right text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">العضو</th>
                      <th className="p-3">{mode === "departments" ? "القسم" : "الرمز"}</th>
                      <th className="p-3">الموضع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3" dir="ltr">
                          {row.date}
                        </td>
                        <td className="p-3">{row.assignee}</td>
                        <td className="p-3">{row.code}</td>
                        <td className="p-3 text-xs text-muted-foreground">{row.where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={checkExisting}
              disabled={busy || checking || !canSave}
            >
              {checking ? "جارٍ فحص الموجود…" : "فحص التكرار والتعارض (dry-run)"}
            </Button>
            <Button
              onClick={save}
              disabled={
                busy ||
                checking ||
                !canSave ||
                preflightKey !== planSignature ||
                conflicts.some(
                  (conflict) => conflict.kind === "duplicate" || conflict.kind === "overlap",
                ) ||
                (conflicts.some((conflict) => conflict.kind === "unverified") &&
                  !acknowledgeWarnings)
              }
            >
              <Upload />
              {busy ? "جارٍ الحفظ…" : "اعتماد المعاينة وحفظها"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={reset}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
