import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/states";
import { InstallApp } from "@/components/install-app";
import { meQuery, errMsg } from "@/lib/app-data";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "حسابي — رفيق المناوبات" },
      { name: "description", content: "الملف الشخصي وإعدادات حساب رفيق المناوبات." },
      { property: "og:title", content: "حسابي — رفيق المناوبات" },
      { property: "og:description", content: "الملف الشخصي وإعدادات الحساب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profile,
});
function Profile() {
  const me = useQuery(meQuery);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(me.data?.fullName ?? "");
  }, [me.data?.fullName]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!me.data) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: failure } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("id", me.data.id)
        .select("id")
        .single();
      if (failure) throw failure;
      if (password) {
        const { error: pwError } = await supabase.auth.updateUser({ password });
        if (pwError) throw pwError;
        setPassword("");
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      setMessage("حُفظت بيانات حسابك.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell title="حسابي" subtitle="بياناتك الشخصية وأمان حسابك.">
      {me.isPending ? (
        <LoadingState />
      ) : me.error ? (
        <ErrorState message={errMsg(me.error)} />
      ) : (
        <form onSubmit={save} className="max-w-lg space-y-5">
          {error && <ErrorState message={error} />}
          {message && <p role="status">{message}</p>}
          <div className="space-y-2">
            <Label htmlFor="profile-name">الاسم الكامل</Label>
            <Input
              id="profile-name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">البريد الإلكتروني</Label>
            <Input id="profile-email" dir="ltr" readOnly value={me.data?.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-password">كلمة مرور جديدة (اختياري)</Label>
            <Input
              id="profile-password"
              type="password"
              dir="ltr"
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button disabled={busy} type="submit">
            {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </Button>
          <div className="border-t pt-5">
            <InstallApp />
          </div>
        </form>
      )}
    </AppShell>
  );
}
