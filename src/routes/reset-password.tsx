import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState } from "@/components/states";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — رفيق المناوبات" },
      { name: "description", content: "عيّن كلمة مرور جديدة لحسابك." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة" },
      { property: "og:description", content: "عيّن كلمة مرور جديدة لحسابك في رفيق المناوبات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 10) return setError("كلمة المرور يجب أن تكون 10 أحرف على الأقل.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-3xl bg-card p-8 shadow-card">
        <h1 className="text-2xl font-bold">كلمة مرور جديدة</h1>
        {error && <ErrorState message={error} />}
        <div className="space-y-2">
          <Label htmlFor="pw">كلمة المرور الجديدة</Label>
          <Input id="pw" type="password" dir="ltr" minLength={10} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button type="submit" className="w-full rounded-full" disabled={busy}>حفظ</Button>
      </form>
    </div>
  );
}
