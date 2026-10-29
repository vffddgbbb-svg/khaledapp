import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { EmptyState, LoadingState } from "@/components/states";
import { meQuery, useLiveSync } from "@/lib/app-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — رفيق المناوبات" },
      { name: "description", content: "نظرة عامة على مناوباتك وطلبات التبديل." },
      { property: "og:title", content: "لوحة التحكم — رفيق المناوبات" },
      { property: "og:description", content: "نظرة عامة على مناوباتك." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const me = useQuery(meQuery);
  const sync = useLiveSync();
  if (me.isLoading) return <LoadingState />;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-primary">رفيق المناوبات</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs" role="status">
            {sync === "live" ? "🟢 التحديث الفوري متصل" : sync === "connecting" ? "جارٍ الاتصال…" : "🔴 غير متصل"}
          </span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}>خروج</Button>
        </div>
      </header>
      <p>مرحباً {me.data?.fullName} {me.data?.isAdmin && "(مشرف)"}</p>
      <EmptyState title="لا توجد بيانات جدول بعد">
        لم يُستورد الجدول الأصلي. لن تُعرض أي مناوبات حتى يستورد المشرف ملف HTML الأصلي.
      </EmptyState>
    </div>
  );
}
