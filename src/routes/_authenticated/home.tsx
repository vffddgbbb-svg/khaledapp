import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ClipboardCheck, Repeat2, Stethoscope } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { errMsg, meQuery, shiftsMonthQuery, shiftTypesQuery, swapsQuery } from "@/lib/app-data";
import { COMPANION_MODULES, SHIFTS_ICON } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية — رفيق الطبيب" },
      { name: "description", content: "لوحة رفيق الطبيب: مناوباتك اليوم، طلبات التبديل، واختصارات الوحدات." },
      { property: "og:title", content: "الرئيسية — رفيق الطبيب" },
      { property: "og:description", content: "لوحة رفيق الطبيب: مناوباتك اليوم، طلبات التبديل، واختصارات الوحدات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Home() {
  const now = new Date();
  const me = useQuery(meQuery);
  const shifts = useQuery(shiftsMonthQuery(now.getFullYear(), now.getMonth() + 1));
  const types = useQuery(shiftTypesQuery);
  const swaps = useQuery(swapsQuery);
  const today = todayISO();
  const loading = me.isPending || shifts.isPending || types.isPending || swaps.isPending;
  const error = me.error || shifts.error || types.error || swaps.error;
  const mine = (shifts.data ?? []).filter((s) => s.member_id === me.data?.id);
  const myToday = mine.filter((s) => s.shift_date === today);
  const myUpcoming = mine.filter((s) => s.shift_date >= today);
  const pending = (swaps.data ?? []).filter((s) => s.status === "pending").length;
  const typeName = (id: string | null) => types.data?.find((t) => t.id === id)?.name ?? "قسم غير محدد";
  const v = (n: number) => (loading || error ? "—" : n.toLocaleString("ar"));

  const cards = [
    { label: "مناوباتي اليوم", value: v(myToday.length), icon: CalendarDays },
    { label: "مناوباتي القادمة هذا الشهر", value: v(myUpcoming.length), icon: ClipboardCheck },
    { label: "طلبات تبديل معلّقة", value: v(pending), icon: Repeat2 },
    { label: "مرضى قيد المتابعة", value: "—", icon: Stethoscope, note: "قيد التجهيز" },
  ];

  return (
    <AppShell title="الرئيسية" subtitle="رفيق الطبيب — نظرة سريعة على يومك.">
      <section className="mb-6 rounded-2xl bg-navy p-6 text-navy-foreground sm:p-8">
        <p className="text-sm opacity-80">
          {now.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          أهلاً{me.data?.fullName ? `، ${me.data.fullName}` : ""}
        </h2>
        <p className="mt-2 text-sm opacity-80">
          {loading ? "جارٍ تحميل يومك…" : error ? "تعذر تحميل بياناتك." : myToday.length > 0 ? `لديك ${myToday.length.toLocaleString("ar")} مناوبة اليوم.` : "لا توجد مناوبة مسجّلة باسمك اليوم."}
        </p>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <c.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
            {c.note && <span className="mt-2 inline-block rounded-full bg-warning px-2 py-0.5 text-[11px] text-warning-foreground">{c.note}</span>}
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-bold">الاختصارات</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/dashboard" className="flex min-h-24 flex-col items-start justify-between rounded-xl border bg-secondary p-4 text-secondary-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <SHIFTS_ICON className="size-6" aria-hidden />
          <span className="font-semibold">المناوبات</span>
        </Link>
        {COMPANION_MODULES.map((m) => (
          <Link key={m.slug} to="/modules/$slug" params={{ slug: m.slug }} className="flex min-h-24 flex-col items-start justify-between rounded-xl border bg-card p-4 focus-visible:outline-2 focus-visible:outline-ring">
            <m.icon className="size-6 text-primary" aria-hidden />
            <span className="font-semibold">{m.label}</span>
            <span className="text-[11px] text-muted-foreground">قيد التجهيز</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">مهام اليوم</h2>
            <Link to="/dashboard" className="flex items-center text-sm text-primary">الجدول <ChevronLeft className="size-4" /></Link>
          </div>
          {loading ? <LoadingState /> : error ? <ErrorState message={errMsg(error)} /> : myToday.length === 0 ? (
            <EmptyState title="لا مناوبات لك اليوم" icon={<CalendarDays className="size-7" aria-hidden />} />
          ) : (
            <ul className="space-y-2">
              {myToday.map((s) => (
                <li key={s.id} className="rounded-lg border bg-card p-3 text-sm">
                  <p className="font-semibold">مناوبة: {typeName(s.shift_type_id)}</p>
                  {s.notes && <p className="mt-1 text-muted-foreground">{s.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">متابعة المرضى</h2>
          <EmptyState title="قيد التجهيز" icon={<Stethoscope className="size-7" aria-hidden />}>
            <p>لا تُحفظ بيانات مرضى في التطبيق حالياً، ولا تُعرض أي سجلات مرضى.</p>
          </EmptyState>
        </section>
      </div>
    </AppShell>
  );
}
