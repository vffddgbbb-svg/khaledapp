import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, FileClock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScheduleImporter } from "@/components/schedule-importer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/form-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ErrorState, LoadingState, EmptyState } from "@/components/states";
import { meQuery, profilesQuery, shiftTypesQuery, errMsg } from "@/lib/app-data";
import { SHIFT_COLORS, SHIFT_COLOR_KEYS, colorOf } from "@/lib/shift-colors";
import { validDate } from "@/lib/import-validation";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/manage")({ head: () => ({ meta: [{ title: "إدارة الجدول — رفيق المناوبات" }, { name: "description", content: "إدارة أنواع المناوبات وإسنادها واستيراد الجدول الأصلي." }, { property: "og:title", content: "إدارة الجدول — رفيق المناوبات" }, { property: "og:description", content: "إدارة واستيراد مناوبات الفريق." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Manage });
function Manage() {
  const me = useQuery(meQuery); const members = useQuery(profilesQuery); const types = useQuery(shiftTypesQuery); const qc = useQueryClient();
  const [type, setType] = useState({ id: "", code: "", name: "", color: "sky", start: "", end: "" }); const [shift, setShift] = useState({ date: "", member: "", type: "", notes: "" });
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [remove, setRemove] = useState("");
  async function saveType(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = { code: type.code.trim(), name: type.name.trim(), color: type.color, start_time: type.start || null, end_time: type.end || null };
      const result = type.id ? await supabase.from("shift_types").update(payload).eq("id", type.id).select("id").single() : await supabase.from("shift_types").insert(payload).select("id").single();
      if (result.error) throw result.error; await qc.invalidateQueries({ queryKey: ["shift_types"] }); setType({ id: "", code: "", name: "", color: "sky", start: "", end: "" }); setMessage("حُفظ نوع المناوبة.");
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  async function saveShift(e: React.FormEvent) {
    e.preventDefault(); if (!me.data || !validDate(shift.date)) return; setBusy(true); setError(""); setMessage("");
    try {
      const { error: failure } = await supabase.rpc("import_schedule", { _rows: [{ date: shift.date, memberId: shift.member, typeId: shift.type }] }); if (failure) throw failure;
      await qc.invalidateQueries({ queryKey: ["shifts"] }); setMessage("حُفظت المناوبة؛ إن كانت مسجلة سابقاً لم تُكرر."); setShift({ date: "", member: "", type: "", notes: "" });
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  async function deleteType() {
    setBusy(true); setError("");
    try { const { error: failure } = await supabase.from("shift_types").delete().eq("id", remove); if (failure) throw failure; await qc.invalidateQueries({ queryKey: ["shift_types"] }); setRemove(""); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  const dataError = me.error || members.error || types.error;
  return <AppShell title="إدارة الجدول" subtitle="أنواع المناوبات وإسنادها للفريق." action={<Button asChild variant="outline" aria-label="سجل التدقيق"><Link to="/audit"><FileClock /><span className="hidden sm:inline">سجل التدقيق</span></Link></Button>}>{me.isPending || members.isPending || types.isPending ? <LoadingState /> : dataError ? <ErrorState message={errMsg(dataError)} /> : !me.data?.isAdmin ? <EmptyState title="هذه الصفحة للمشرف فقط" /> : <>{error && <ErrorState message={error} />}{message && <p role="status" className="mb-4 text-sm">{message}</p>}<section className="pb-6"><h2 className="mb-4 text-xl font-bold">أنواع المناوبات</h2>{types.data?.length === 0 && <p className="mb-4 text-sm text-muted-foreground">لم تُسجّل أنواع مناوبات بعد.</p>}<div className="mb-5 flex flex-wrap gap-2">{types.data?.map(t => <div key={t.id} className="flex items-center gap-1"><Button variant="outline" className={colorOf(t.color).chip} onClick={() => setType({ id: t.id, code: t.code, name: t.name, color: t.color, start: t.start_time?.slice(0,5) ?? "", end: t.end_time?.slice(0,5) ?? "" })}>{t.code} · {t.name}</Button><Button variant="ghost" size="icon" aria-label={`حذف نوع ${t.name}`} onClick={() => setRemove(t.id)}><Trash2 /></Button></div>)}</div><form onSubmit={saveType} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="space-y-2"><Label htmlFor="type-code">رمز المناوبة</Label><Input id="type-code" required maxLength={30} value={type.code} onChange={e => setType({ ...type, code: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="type-name">اسم المناوبة</Label><Input id="type-name" required maxLength={100} value={type.name} onChange={e => setType({ ...type, name: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="type-color">اللون</Label><FormSelect id="type-color" value={type.color} onChange={e => setType({ ...type, color: e.target.value })}>{SHIFT_COLOR_KEYS.map(c => <option key={c} value={c}>{SHIFT_COLORS[c].label}</option>)}</FormSelect></div><div className="space-y-2"><Label htmlFor="type-start">وقت البداية</Label><Input id="type-start" type="time" value={type.start} onChange={e => setType({ ...type, start: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="type-end">وقت النهاية</Label><Input id="type-end" type="time" value={type.end} onChange={e => setType({ ...type, end: e.target.value })} /></div><div className="flex items-end gap-2"><Button disabled={busy} type="submit"><Plus />{type.id ? "حفظ النوع" : "إضافة النوع"}</Button>{type.id && <Button type="button" variant="ghost" onClick={() => setType({ id: "", code: "", name: "", color: "sky", start: "", end: "" })}>إلغاء</Button>}</div></form></section><section className="border-t py-6"><h2 className="mb-4 text-xl font-bold">إسناد مناوبة</h2><form onSubmit={saveShift} className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="shift-date">التاريخ</Label><Input id="shift-date" type="date" required value={shift.date} onChange={e => setShift({ ...shift, date: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="shift-member">العضو</Label><FormSelect id="shift-member" required value={shift.member} onChange={e => setShift({ ...shift, member: e.target.value })}><option value="">اختر العضو</option>{members.data?.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}</FormSelect></div><div className="space-y-2"><Label htmlFor="shift-type">نوع المناوبة</Label><FormSelect id="shift-type" required value={shift.type} onChange={e => setShift({ ...shift, type: e.target.value })}><option value="">اختر النوع</option>{types.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</FormSelect></div><div className="flex items-end"><Button type="submit" disabled={busy || !members.data?.length || !types.data?.length}>حفظ المناوبة</Button></div></form></section><ScheduleImporter /></>}<Dialog open={Boolean(remove)} onOpenChange={open => { if (!open && !busy) setRemove(""); }}><DialogContent dir="rtl"><DialogHeader><DialogTitle>حذف نوع المناوبة؟</DialogTitle><DialogDescription>لا يمكن حذف نوع مرتبط بمناوبات مسجلة.</DialogDescription></DialogHeader>{error && <ErrorState message={error} />}<Button variant="destructive" disabled={busy} onClick={deleteType}>تأكيد الحذف</Button></DialogContent></Dialog></AppShell>;
}