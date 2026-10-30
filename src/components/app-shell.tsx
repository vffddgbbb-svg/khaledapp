import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Repeat2, Users, LogOut, ChevronLeft, Heart, RefreshCw, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { meQuery } from "@/lib/app-data";
import { supabase } from "@/integrations/supabase/client";

export const PREVIEW_URL = "https://id-preview--f826536b-190c-4e21-a983-b01ac9235739.lovable.app/";

export function PreviewLink() {
  return <div className="mt-4 flex flex-col items-center gap-2"><p className="text-xs text-muted-foreground">رابط معاينة التطبيق (نسخة تجريبية — ليست النسخة المنشورة):</p><Button asChild variant="outline" size="sm"><a href={PREVIEW_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />فتح المعاينة في تبويب جديد</a></Button><code dir="ltr" className="max-w-full break-all text-[11px] text-muted-foreground">{PREVIEW_URL}</code></div>;
}

export function Brand() {
  return <span className="flex min-w-0 items-center gap-3"><span className="brand-symbol grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><CalendarDays className="size-6" /><Heart className="brand-heart size-3" /></span><span className="min-w-0"><span className="block truncate font-display text-xl font-extrabold">رفيق المناوبات</span><span className="block text-xs text-muted-foreground">كل مناوبة، في مكانها</span></span></span>;
}

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen"><header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 sm:px-8"><Link to="/" aria-label="رفيق المناوبات — الرئيسية"><Brand /></Link><ThemeToggle /></header><main>{children}</main><footer className="mx-auto max-w-6xl px-5 py-8 text-center text-xs text-muted-foreground">رفيق المناوبات <span className="mx-2">·</span> مساحة فريقك المشتركة<PreviewLink /></footer></div>;
}

export function AppShell({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  const me = useQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const nav = [{ to: "/dashboard" as const, label: "جدول المناوبات", icon: CalendarDays }, { to: "/swaps" as const, label: "طلبات التبديل", icon: Repeat2 }, ...(me.data?.isAdmin ? [{ to: "/members" as const, label: "إدارة الأعضاء", icon: Users }] : [])];
  return <div className="min-h-screen bg-background">
    <header className="border-b bg-card"><div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-8"><Link to="/dashboard"><Brand /></Link><div className="flex shrink-0 items-center gap-1"><span className="hidden max-w-48 truncate px-3 text-sm sm:block">{me.data?.fullName}</span><ThemeToggle /><Button variant="ghost" size="icon" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }}><LogOut /></Button></div></div></header>
    <div className="mx-auto grid max-w-7xl lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b bg-card lg:min-h-[calc(100vh-78px)] lg:border-b-0 lg:border-l"><nav aria-label="التنقل الرئيسي" className="grid grid-cols-3 gap-1 p-2 lg:grid-cols-1 lg:gap-2 lg:p-5">{nav.map(item => <Button key={item.to} asChild variant="ghost" className="h-auto min-h-12 whitespace-normal px-2 py-3 text-xs lg:justify-start lg:px-3 lg:text-sm"><Link to={item.to} activeProps={{ className: "bg-secondary text-secondary-foreground font-bold" }}><item.icon className="shrink-0" /><span>{item.label}</span></Link></Button>)}</nav><div className="hidden px-7 pt-8 text-xs leading-7 text-muted-foreground lg:block">مساحة الفريق<br /><span className="text-foreground">{me.data?.isAdmin ? "حساب المشرف" : "حساب العضو"}</span></div></aside>
      <main className="min-w-0 px-4 py-7 sm:px-8 sm:py-9"><div className="mb-7 text-xs text-muted-foreground">مساحة الفريق <ChevronLeft className="mx-1 inline size-3" /> {title}</div><div className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0"><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>{action ?? <Button variant="outline" size="icon" title="تحديث البيانات" aria-label="تحديث البيانات" onClick={() => qc.invalidateQueries()}><RefreshCw /></Button>}</div>{children}<p className="mt-10 text-xs text-muted-foreground">تُعرض البيانات المسجلة فقط. حالة الاتصال الفوري غير مؤكدة.</p></main>
    </div>
  </div>;
}