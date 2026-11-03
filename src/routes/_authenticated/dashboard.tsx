import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Search, Repeat2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { AR_DAYS, AR_MONTHS, errMsg, meQuery, profilesQuery, shiftsMonthQuery, shiftTypesQuery } from "@/lib/app-data";
import { calendarDates, filterShifts } from "@/lib/schedule-view";
import { colorOf } from "@/lib/shift-colors";
import type { Tables } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "جدول المناوبات — رفيق المناوبات" }, { name: "description", content: "جدول الفريق الشهري والمناوبات المسجلة." }, { property: "og:title", content: "جدول المناوبات — رفيق المناوبات" }, { property: "og:description", content: "جدول الفريق الشهري والمناوبات المسجلة." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Dashboard,
});
function Dashboard() {
  const [month, setMonth] = useState(() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1 }; });
  const [term, setTerm] = useState(""); const [mine, setMine] = useState(false); const [dept, setDept] = useState(""); const [view, setView] = useState<"calendar" | "list">("calendar");
  const me = useQuery(meQuery); const shifts = useQuery(shiftsMonthQuery(month.year, month.month)); const profiles = useQuery(profilesQuery); const types = useQuery(shiftTypesQuery);
  const error = shifts.error || profiles.error || types.error || me.error;
  const loading = shifts.isPending || profiles.isPending || types.isPending || me.isPending;
  const rows = filterShifts(shifts.data ?? [], profiles.data ?? [], term, mine ? me.data?.id : undefined).filter(s => !dept || s.shift_type_id === dept);
  function changeMonth(delta: number) { const date = new Date(month.year, month.month - 1 + delta, 1); setMonth({ year: date.getFullYear(), month: date.getMonth() + 1 }); }
  function shiftItem(shift: Tables<"shifts">) {
    const type = types.data?.find(t => t.id === shift.shift_type_id); const name = profiles.data?.find(p => p.id === shift.member_id)?.full_name || shift.assignee_label || "غير معيّن";
    return <div key={shift.id} className={`rounded-md px-2.5 py-2 text-xs ${colorOf(type?.color).chip}`}><p className="break-words font-semibold">{name}</p><p className="mt-1">{type?.name ?? "نوع غير محدد"}</p>{type?.start_time && <p className="mt-1" dir="ltr">{type.start_time.slice(0, 5)}{type.end_time ? ` — ${type.end_time.slice(0, 5)}` : ""}</p>}{shift.notes && <p className="mt-1 break-words">{shift.notes}</p>}</div>;
  }
  return <AppShell title="جدول المناوبات" subtitle="مناوبات الفريق، شهراً بشهر." action={<Button asChild className="hidden sm:inline-flex"><Link to="/swaps"><Repeat2 />طلب تبديل</Link></Button>}>
    <div className="mb-6 grid grid-cols-2 gap-4 border-y py-5 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">مناوبات الشهر</p><p className="mt-2 text-2xl font-bold">{loading || error ? "—" : shifts.data?.length ?? 0}</p></div><div><p className="text-xs text-muted-foreground">مناوباتي</p><p className="mt-2 text-2xl font-bold">{loading || error ? "—" : shifts.data?.filter(s => s.member_id === me.data?.id).length ?? 0}</p></div><div className="hidden sm:block"><p className="text-xs text-muted-foreground">الفترة</p><p className="mt-2 font-semibold">{AR_MONTHS[month.month - 1]} {month.year}</p></div></div>
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><div className="flex min-w-0 items-center gap-1"><Button variant="ghost" size="icon" aria-label="الشهر السابق" title="الشهر السابق" onClick={() => changeMonth(-1)}><ChevronRight /></Button><h2 className="min-w-0 truncate text-lg font-bold">{AR_MONTHS[month.month - 1]} {month.year}</h2><Button variant="ghost" size="icon" aria-label="الشهر التالي" title="الشهر التالي" onClick={() => changeMonth(1)}><ChevronLeft /></Button></div><Button variant="outline" size="sm" onClick={() => { const d = new Date(); setMonth({ year: d.getFullYear(), month: d.getMonth() + 1 }); }}>هذا الشهر</Button></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="relative min-w-0"><Search className="absolute right-3 top-3 size-4 text-muted-foreground" /><Input aria-label="البحث باسم العضو" className="h-10 pr-10" placeholder="ابحث باسم العضو…" value={term} onChange={e => setTerm(e.target.value)} /></div><div className="flex gap-1"><Button variant={mine ? "ghost" : "secondary"} aria-pressed={!mine} onClick={() => setMine(false)}>الفريق</Button><Button variant={mine ? "secondary" : "ghost"} aria-pressed={mine} onClick={() => setMine(true)}>مناوباتي</Button></div><div className="hidden gap-1 md:flex"><Button variant={view === "calendar" ? "secondary" : "ghost"} size="icon" title="عرض التقويم" aria-label="عرض التقويم" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><CalendarDays /></Button><Button variant={view === "list" ? "secondary" : "ghost"} size="icon" title="عرض القائمة" aria-label="عرض القائمة" aria-pressed={view === "list"} onClick={() => setView("list")}><List /></Button></div></div>
    {loading ? <LoadingState /> : error ? <ErrorState message={errMsg(error)} /> : <>
      {types.data && types.data.length > 0 && <div className="mb-4 flex flex-wrap gap-4">{types.data.map(t => <span key={t.id} className="flex items-center gap-2 text-xs"><span className={`size-2.5 rounded-full ${colorOf(t.color).dot}`} />{t.name}</span>)}</div>}
      {rows.length === 0 && <div className="mb-5"><EmptyState title={(shifts.data?.length ?? 0) === 0 ? "لم تُسجّل مناوبات لهذا الشهر" : "لا توجد مناوبات مطابقة"} icon={<CalendarDays className="size-7" />}><p>{(shifts.data?.length ?? 0) === 0 ? "الجدول الأصلي الكامل مطلوب لإضافة مناوبات هذه الفترة." : "جرّب اسماً آخر أو اعرض مناوبات الفريق."}</p>{me.data?.isAdmin && <Button asChild variant="outline" className="mt-4"><Link to="/manage">استيراد الجدول</Link></Button>}</EmptyState></div>}
      <div className={view === "calendar" ? "hidden overflow-hidden rounded-lg border bg-card md:block" : "hidden"}><div className="grid grid-cols-7 bg-muted">{AR_DAYS.map(day => <div key={day} className="p-3 text-center text-xs font-semibold">{day}</div>)}</div><div className="grid grid-cols-7">{calendarDates(month.year, month.month).map((date, i) => <div key={date ?? `blank-${i}`} className={`min-h-32 min-w-0 border-b border-l p-2 ${date ? "" : "bg-muted/40"}`}>{date && <><span className="mb-2 block text-xs text-muted-foreground">{Number(date.slice(-2)).toLocaleString("ar")}</span><div className="space-y-1.5">{rows.filter(s => s.shift_date === date).map(shiftItem)}</div></>}</div>)}</div></div>
      {rows.length > 0 && <div className={view === "calendar" ? "space-y-5 md:hidden" : "space-y-5"}>{[...new Set(rows.map(s => s.shift_date))].map(date => <section key={date}><h3 className="mb-2 text-sm font-bold">{new Date(`${date}T12:00:00`).toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" })}</h3><div className="grid gap-2 sm:grid-cols-2">{rows.filter(s => s.shift_date === date).map(shiftItem)}</div></section>)}</div>}
    </>}
  </AppShell>;
}
