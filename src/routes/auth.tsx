import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState } from "@/components/states";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — رفيق المناوبات" },
      { name: "description", content: "سجّل دخولك إلى رفيق المناوبات." },
      { property: "og:title", content: "تسجيل الدخول — رفيق المناوبات" },
      { property: "og:description", content: "سجّل دخولك إلى رفيق المناوبات." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setError("البريد أو كلمة المرور غير صحيحة.");
      navigate({ to: "/dashboard", replace: true });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) return setError(error.message);
      toast.success("إن كان البريد مسجلاً فستصلك رسالة لإعادة التعيين.");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-3xl bg-card p-8 shadow-card" noValidate={false}>
        <div className="text-center">
          <Link to="/" className="font-display text-3xl font-extrabold text-primary">رفيق المناوبات</Link>
          <h1 className="mt-2 text-xl font-bold">{mode === "login" ? "أهلاً بعودتك 👋" : "استعادة كلمة المرور"}</h1>
        </div>
        {error && <ErrorState message={error} />}
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === "login" && (
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <Button type="submit" className="w-full rounded-full" size="lg" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {mode === "login" ? "دخول" : "إرسال رابط الاستعادة"}
        </Button>
        <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setError(null); }}>
          {mode === "login" ? "نسيت كلمة المرور؟" : "العودة لتسجيل الدخول"}
        </button>
        <p className="text-center text-xs text-muted-foreground">لا يوجد تسجيل عام — يطلب حسابك من المشرف.</p>
      </form>
    </div>
  );
}
