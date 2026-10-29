import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarHeart, Repeat2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "رفيق المناوبات — جدول فريقك بابتسامة" },
      { name: "description", content: "تطبيق عربي لجدولة المناوبات، طلبات التبديل بموافقة المشرف، وسجل تدقيق كامل." },
      { property: "og:title", content: "رفيق المناوبات" },
      { property: "og:description", content: "جدولة المناوبات وطلبات التبديل بموافقة المشرف وتحديث فوري للجميع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const features = [
    { icon: CalendarHeart, title: "تقويم شهري ملوّن", text: "لكل نوع مناوبة لونه، مع بحث سريع بالاسم." },
    { icon: Repeat2, title: "طلبات تبديل", text: "يرسل العضو الطلب، والمشرف يوافق أو يرفض." },
    { icon: ShieldCheck, title: "سجل تدقيق", text: "من غيّر ماذا ومتى، بشكل دائم." },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <span className="font-display text-2xl font-extrabold text-primary">رفيق المناوبات</span>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <section className="bg-hero relative overflow-hidden rounded-[2rem] p-8 text-primary-foreground shadow-pop sm:p-14">
          <Sparkles className="absolute -top-4 left-6 size-24 opacity-20" aria-hidden />
          <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">مناوباتك مرتبة،<br />وفريقك مرتاح.</h1>
          <p className="mt-4 max-w-lg text-lg opacity-95">جدول مشترك يتحدث لحظياً لكل الفريق، وطلبات تبديل يعتمدها المشرف.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="rounded-full text-base">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          </div>
        </section>
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-3xl bg-card p-6 shadow-card">
              <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
                <f.icon className="size-6" aria-hidden />
              </div>
              <h2 className="text-xl font-bold">{f.title}</h2>
              <p className="mt-1 text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          الحسابات يُنشئها المشرف فقط. مالك التطبيق؟{" "}
          <Link to="/setup" className="font-medium text-primary underline-offset-4 hover:underline">الإعداد الأولي</Link>
        </p>
      </main>
    </div>
  );
}
