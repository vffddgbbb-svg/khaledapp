import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/states";
import { profilesQuery, shiftTypesQuery, errMsg } from "@/lib/app-data";
import { readSchedule, resolveSchedule, type ScheduleRow } from "@/lib/import-validation";
import { supabase } from "@/integrations/supabase/client";
export function ScheduleImporter() {
  const profiles = useQuery(profilesQuery); const types = useQuery(shiftTypesQuery); const qc = useQueryClient();
  const [rows, setRows] = useState<ScheduleRow[]>([]); const [error, setError] = useState(""); const [result, setResult] = useState(""); const [busy, setBusy] = useState(false);
  async function read(file?: File) {
    setRows([]); setError(""); setResult("");
    if (!file) return;
    if (file.size > 2_000_000) { setError("الملف أكبر من 2 ميغابايت."); return; }
    try {
      const data = readSchedule(await file.text(), /\.html?$/i.test(file.name));
      resolveSchedule(data, profiles.data ?? [], types.data ?? []);
      setRows(data);
    } catch (e) { setError(errMsg(e)); }
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const resolved = resolveSchedule(rows, profiles.data ?? [], types.data ?? []);
      const { data, error: failure } = await supabase.rpc("import_schedule", { _rows: resolved });
      if (failure) throw failure;
      setResult(`حُفظت ${data} مناوبة جديدة. التكرارات لم تُضف.`); setRows([]);
      await qc.invalidateQueries({ queryKey: ["shifts"] });
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t py-6"><h2 className="text-xl font-bold">استيراد الجدول الأصلي</h2><p className="text-sm text-muted-foreground">HTML أو CSV بأعمدة: التاريخ، العضو، رمز المناوبة. التاريخ بصيغة YYYY-MM-DD والأسماء والرموز مطابقة للفريق المسجل.</p><Label htmlFor="schedule-file">ملف الجدول</Label><Input id="schedule-file" type="file" accept=".csv,.html,.htm" disabled={busy || profiles.isPending || types.isPending} onChange={e => read(e.target.files?.[0])} />{error && <ErrorState message={error} />}{result && <p role="status" className="text-sm text-success">{result}</p>}{rows.length > 0 && <><h3 className="font-semibold">معاينة قبل الحفظ — {rows.length} صف</h3><div className="max-h-80 overflow-auto rounded-lg border"><table className="w-full text-right text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-3">التاريخ</th><th className="p-3">العضو</th><th className="p-3">الرمز</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t"><td className="p-3" dir="ltr">{row.date}</td><td className="p-3">{row.assignee}</td><td className="p-3">{row.code}</td></tr>)}</tbody></table></div><div className="flex gap-2"><Button onClick={save} disabled={busy}><Upload />{busy ? "جارٍ الحفظ…" : "تأكيد الاستيراد"}</Button><Button variant="outline" disabled={busy} onClick={() => setRows([])}>إلغاء</Button></div></>}</section>;
}