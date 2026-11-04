import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Repeat2,
  Users,
  LogOut,
  ChevronLeft,
  Heart,
  RefreshCw,
  UserRound,
  Settings2,
  House,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { meQuery, useLiveSync } from "@/lib/app-data";
import { supabase } from "@/integrations/supabase/client";
import { InstallApp } from "@/components/install-app";

export function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="brand-symbol grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <CalendarDays className="size-6" />
        <Heart className="brand-heart size-3" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-xl font-extrabold">رفيق المناوبات</span>
        <span className="block text-xs text-muted-foreground">كل مناوبة، في مكانها</span>
      </span>
    </span>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 sm:px-8">
        <Link to="/" aria-label="رفيق المناوبات — الرئيسية">
          <Brand />
        </Link>
        <div className="flex items-center gap-2">
          <InstallApp />
          <ThemeToggle />
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto max-w-6xl px-5 py-8 text-center text-xs text-muted-foreground">
        رفيق المناوبات · ضمن رفيق الطبيب
        <br />
        حقوق التأليف © خالد خليل العيسى
      </footer>
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const me = useQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sync = useLiveSync();
  const nav = [
    { to: "/home" as const, label: "الرئيسية", icon: House },
    { to: "/dashboard" as const, label: "الجدول", icon: CalendarDays },
    { to: "/swaps" as const, label: "التبديل", icon: Repeat2 },
    ...(me.data?.isAdmin
      ? [
          { to: "/members" as const, label: "الأعضاء", icon: Users },
          { to: "/manage" as const, label: "الإدارة", icon: Settings2 },
        ]
      : []),
    { to: "/profile" as const, label: "حسابي", icon: UserRound },
  ];
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-8">
          <Link to="/home">
            <Brand />
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <span className="hidden max-w-48 truncate px-3 text-sm sm:block">
              {me.data?.fullName}
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              onClick={async () => {
                await qc.cancelQueries();
                qc.clear();
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="mobile-nav border-b bg-card lg:min-h-[calc(100vh-78px)] lg:border-b-0 lg:border-l">
          <nav
            aria-label="التنقل الرئيسي"
            className="flex justify-around gap-1 p-2 lg:flex-col lg:gap-2 lg:p-5"
          >
            {nav.map((item) => (
              <Button
                key={item.to}
                asChild
                variant="ghost"
                className="h-auto min-h-12 min-w-0 flex-1 flex-col gap-1 whitespace-normal px-1 py-2 text-[11px] lg:flex-row lg:justify-start lg:px-3 lg:py-3 lg:text-sm"
              >
                <Link
                  to={item.to}
                  activeProps={{ className: "bg-secondary text-secondary-foreground font-bold" }}
                >
                  <item.icon className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            ))}
          </nav>
          <div className="hidden px-7 pt-8 text-xs leading-7 text-muted-foreground lg:block">
            مساحة الفريق
            <br />
            <span className="text-foreground">
              {me.data?.isAdmin ? "حساب المشرف" : "حساب العضو"}
            </span>
            <div className="mt-5">
              <InstallApp />
            </div>
          </div>
        </aside>
        <main className="app-main min-w-0 px-4 py-7 sm:px-8 sm:py-9">
          <div className="mb-7 text-xs text-muted-foreground">
            مساحة الفريق <ChevronLeft className="mx-1 inline size-3" /> {title}
          </div>
          <div className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {action ?? (
              <Button
                variant="outline"
                size="icon"
                title="تحديث البيانات"
                aria-label="تحديث البيانات"
                onClick={() => qc.invalidateQueries()}
              >
                <RefreshCw />
              </Button>
            )}
          </div>
          {children}
          <p role="status" className="mt-10 text-xs text-muted-foreground">
            {sync === "live"
              ? "متصل بقناة التحديثات"
              : sync === "connecting"
                ? "جارٍ الاتصال بالتحديثات…"
                : "الاتصال بالتحديثات منقطع؛ حدّث الصفحة للتحقق من الجدول."}
          </p>
        </main>
      </div>
      <footer className="px-4 pb-24 pt-4 text-center text-xs text-muted-foreground lg:pb-6">
        رفيق المناوبات · ضمن رفيق الطبيب — حقوق التأليف © خالد خليل العيسى
      </footer>
    </div>
  );
}
