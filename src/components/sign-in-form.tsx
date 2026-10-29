import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ArrowLeft, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";

export function SignInForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      if (mode === "login") {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) { setError("تعذر الدخول. تحقق من البريد وكلمة المرور ثم حاول مجدداً."); return; }
        await navigate({ to: "/dashboard", replace: true });
      } else {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (result.error) { setError("تعذر إرسال رابط الاستعادة. حاول مجدداً لاحقاً."); return; }
        toast.success("إن كان البريد مسجلاً فستصلك رسالة لإعادة التعيين.");
      }
    } catch { setError("تعذر الاتصال. تحقق من اتصالك وحاول مجدداً."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="w-full space-y-5"><div><span className="mb-4 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"><LockKeyhole className="size-3.5" /> مساحة خاصة للفريق</span><h1 className="text-3xl font-extrabold">{mode === "login" ? "أهلاً بعودتك" : "استعادة كلمة المرور"}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "سجّل الدخول إلى حسابك في رفيق المناوبات." : "أدخل البريد المرتبط بحسابك."}</p></div>{error && <ErrorState message={error} />}<div className="space-y-2"><Label htmlFor="email">البريد الإلكتروني</Label><Input className="h-12" id="email" type="email" dir="ltr" placeholder="name@example.com" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>{mode === "login" && <div className="space-y-2"><Label htmlFor="password">كلمة المرور</Label><Input className="h-12" id="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>}<Button type="submit" className="h-12 w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ArrowLeft />}{mode === "login" ? "تسجيل الدخول" : "إرسال رابط الاستعادة"}</Button><Button variant="link" className="w-full" type="button" onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setError(null); }}>{mode === "login" ? "نسيت كلمة المرور؟" : "العودة لتسجيل الدخول"}</Button><p className="border-t pt-5 text-center text-xs leading-6 text-muted-foreground">ليس لديك حساب؟ تواصل مع مشرف فريقك.<br />الحسابات ينشئها المشرف فقط.</p></form>;
}