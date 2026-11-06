import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimAdmin, getSetupStatus } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState, LoadingState } from "@/components/states";
import { errMsg } from "@/lib/app-data";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "الإعداد الأولي — رفيق المناوبات" },
      {
        name: "description",
        content: "مطالبة مالك التطبيق بحساب المشرف باستخدام رمز إعداد لمرة واحدة.",
      },
      { property: "og:title", content: "الإعداد الأولي — رفيق المناوبات" },
      { property: "og:description", content: "مطالبة المالك بحساب المشرف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const statusFn = useServerFn(getSetupStatus);
  const claim = useServerFn(claimAdmin);
  const status = useQuery({ queryKey: ["setup-status"], queryFn: () => statusFn() });
  const [form, setForm] = useState({ fullName: "", email: "", password: "", token: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 10) return setError("كلمة المرور 10 أحرف على الأقل.");
    setBusy(true);
    try {
      await claim({ data: form });
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (loginError)
        throw new Error("أُنشئ الحساب، لكن تعذر الدخول. انتقل إلى صفحة تسجيل الدخول.");
      toast.success("تم إنشاء حساب المشرف 🎉");
      navigate({ to: "/home" });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-5 rounded-3xl bg-card p-8 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <KeyRound aria-hidden />
          </div>
          <h1 className="text-2xl font-bold">الإعداد الأولي للمشرف</h1>
        </div>
        {status.isLoading && <LoadingState />}
        {status.error && <ErrorState message={errMsg(status.error)} />}
        {status.data?.adminExists && (
          <div className="space-y-3">
            <p>تم إعداد حساب المشرف مسبقاً، وهذه الصفحة مغلقة الآن.</p>
            <Button asChild className="rounded-full">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          </div>
        )}
        {status.data && !status.data.adminExists && !status.data.tokenConfigured && (
          <ErrorState message="لم يُضبط رمز الإعداد (ADMIN_SETUP_TOKEN) على الخادم بعد. يجب على مالك المشروع إضافته في إعدادات المشروع ← الأسرار، ثم إعادة تحميل الصفحة." />
        )}
        {status.data && !status.data.adminExists && status.data.tokenConfigured && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              أدخل رمز الإعداد السري الذي ضبطته في أسرار المشروع. يعمل مرة واحدة فقط.
            </p>
            {error && <ErrorState message={error} />}
            {(
              [
                ["fullName", "الاسم الكامل", "text", "name"],
                ["email", "البريد الإلكتروني", "email", "email"],
                ["password", "كلمة المرور (10 أحرف+)", "password", "new-password"],
                ["token", "رمز الإعداد", "password", "off"],
              ] as const
            ).map(([k, label, type, ac]) => (
              <div key={k} className="space-y-2">
                <Label htmlFor={k}>{label}</Label>
                <Input
                  id={k}
                  type={type}
                  required
                  autoComplete={ac}
                  dir={k === "fullName" ? "rtl" : "ltr"}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
            <Button type="submit" className="w-full rounded-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} المطالبة بحساب
              المشرف
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
