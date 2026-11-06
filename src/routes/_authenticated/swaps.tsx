import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Clock3, Plus, Repeat2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/form-select";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import { errMsg, meQuery, profilesQuery, swapsQuery, shiftTypesQuery } from "@/lib/app-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/swaps")({
  head: () => ({
    meta: [
      { title: "طلبات التبديل — رفيق المناوبات" },
      { name: "description", content: "طلبات تبديل مناوبات الفريق ومراجعتها." },
      { property: "og:title", content: "طلبات التبديل — رفيق المناوبات" },
      { property: "og:description", content: "طلبات تبديل مناوبات الفريق ومراجعتها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Swaps,
});
const labels = {
  pending: "بانتظار المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
  cancelled: "ملغى",
};
const tones = {
  pending: "bg-warning/20 text-warning-foreground",
  approved: "bg-success/15 text-foreground",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};
function Swaps() {
  const me = useQuery(meQuery);
  const profiles = useQuery(profilesQuery);
  const swaps = useQuery(swapsQuery);
  const types = useQuery(shiftTypesQuery);
  const shifts = useQuery({
    queryKey: ["swap-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("shift_date");
      if (error) throw error;
      return data;
    },
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ shift: "", member: "", target: "", reason: "" });
  const [review, setReview] = useState<{ id: string; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const dataError = me.error || profiles.error || shifts.error || swaps.error || types.error;
  const loading =
    me.isPending || profiles.isPending || shifts.isPending || swaps.isPending || types.isPending;
  const ownShifts = shifts.data?.filter((s) => s.member_id === me.data?.id) ?? [];
  const available = profiles.data?.filter((p) => p.id !== me.data?.id) ?? [];
  const shiftLabel = (id: string) => {
    const s = shifts.data?.find((s) => s.id === id);
    if (!s) return "مناوبة غير متاحة";
    return `${s.shift_date} · ${types.data?.find((t) => t.id === s.shift_type_id)?.name ?? "نوع غير محدد"}`;
  };
  const name = (id: string) => profiles.data?.find((p) => p.id === id)?.full_name || "عضو";
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["swaps"] }),
      qc.invalidateQueries({ queryKey: ["shifts"] }),
      qc.invalidateQueries({ queryKey: ["swap-shifts"] }),
    ]);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me.data) return;
    setBusy(true);
    setError(null);
    try {
      const result = await supabase
        .from("swap_requests")
        .insert({
          requester_id: me.data.id,
          requester_shift_id: form.shift,
          target_member_id: form.member,
          target_shift_id: form.target || null,
          reason: form.reason.trim() || null,
        })
        .select("id")
        .single();
      if (result.error) throw result.error;
      await refresh();
      setOpen(false);
      setForm({ shift: "", member: "", target: "", reason: "" });
      toast.success("سُجّل الطلب وبانتظار مراجعة المشرف.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function reviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.rpc("review_swap", {
        _request_id: review.id,
        _approve: review.approve,
        ...(note.trim() ? { _note: note.trim() } : {}),
      });
      if (result.error) throw result.error;
      await refresh();
      setReview(null);
      toast.success("حُفظت مراجعة الطلب.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.rpc("cancel_swap", { _request_id: id });
      if (result.error) throw result.error;
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      title="طلبات التبديل"
      subtitle="طلباتك ومراجعات المشرف في مكان واحد."
      action={
        <Button
          aria-label="طلب تبديل جديد"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <Plus />
          <span className="hidden sm:inline">طلب جديد</span>
        </Button>
      }
    >
      <div className="mb-6 flex gap-2 border-b pb-4">
        <Button
          variant={filter === "all" ? "secondary" : "ghost"}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          كل الطلبات
        </Button>
        <Button
          variant={filter === "pending" ? "secondary" : "ghost"}
          aria-pressed={filter === "pending"}
          onClick={() => setFilter("pending")}
        >
          <Clock3 />
          بانتظار المراجعة
        </Button>
      </div>
      {error && !open && !review && <ErrorState message={error} />}
      {loading ? (
        <LoadingState />
      ) : dataError ? (
        <ErrorState message={errMsg(dataError)} />
      ) : (swaps.data?.filter((s) => filter === "all" || s.status === filter).length ?? 0) === 0 ? (
        <EmptyState title="لا توجد طلبات تبديل" icon={<Repeat2 className="size-7" />}>
          ستظهر هنا الطلبات المسجلة للحساب الحالي.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {swaps.data
            ?.filter((s) => filter === "all" || s.status === filter)
            .map((s) => (
              <article key={s.id} className="rounded-lg border bg-card p-5">
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-bold">{name(s.requester_id)}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("ar")}
                    </p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs ${tones[s.status]}`}>
                    {labels[s.status]}
                  </span>
                </header>
                <div className="my-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">المناوبة الحالية</p>
                    <p className="mt-1 text-sm" dir="auto">
                      {shiftLabel(s.requester_shift_id)}
                    </p>
                  </div>
                  <ArrowLeft className="hidden size-5 self-center text-muted-foreground sm:block" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">إلى {name(s.target_member_id)}</p>
                    <p className="mt-1 text-sm" dir="auto">
                      {s.target_shift_id
                        ? shiftLabel(s.target_shift_id)
                        : "نقل المناوبة دون مناوبة مقابلة"}
                    </p>
                  </div>
                </div>
                {s.reason && <p className="break-words border-t pt-3 text-sm">{s.reason}</p>}
                {s.review_note && (
                  <p className="mt-3 break-words text-sm text-muted-foreground">
                    ملاحظة المشرف: {s.review_note}
                  </p>
                )}
                {s.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    {me.data?.isAdmin ? (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setError(null);
                            setNote("");
                            setReview({ id: s.id, approve: true });
                          }}
                        >
                          <Check />
                          موافقة
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setError(null);
                            setNote("");
                            setReview({ id: s.id, approve: false });
                          }}
                        >
                          <X />
                          رفض
                        </Button>
                      </>
                    ) : s.requester_id === me.data?.id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => cancel(s.id)}
                      >
                        إلغاء الطلب
                      </Button>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>طلب تبديل مناوبة</DialogTitle>
            <DialogDescription>يبقى الجدول الحالي كما هو حتى موافقة المشرف.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <LoadingState />
          ) : dataError ? (
            <ErrorState message={errMsg(dataError)} />
          ) : ownShifts.length === 0 || available.length === 0 ? (
            <EmptyState title="لا يمكن إرسال طلب الآن">
              {ownShifts.length === 0
                ? "لا توجد مناوبات مرتبطة بحسابك."
                : "لا يوجد عضو آخر مسجل لاختياره."}
            </EmptyState>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              {error && <ErrorState message={error} />}
              <div className="space-y-2">
                <Label htmlFor="own-shift">مناوبتك</Label>
                <FormSelect
                  id="own-shift"
                  required
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value })}
                >
                  <option value="">اختر المناوبة</option>
                  {ownShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {shiftLabel(s.id)}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-member">العضو الآخر</Label>
                <FormSelect
                  id="target-member"
                  required
                  value={form.member}
                  onChange={(e) => setForm({ ...form, member: e.target.value, target: "" })}
                >
                  <option value="">اختر العضو</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-shift">المناوبة المقابلة (اختياري)</Label>
                <FormSelect
                  id="target-shift"
                  disabled={!form.member}
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                >
                  <option value="">نقل المناوبة دون مقابل</option>
                  {shifts.data
                    ?.filter((s) => s.member_id === form.member)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {shiftLabel(s.id)}
                      </option>
                    ))}
                </FormSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">سبب الطلب (اختياري)</Label>
                <Textarea
                  id="reason"
                  maxLength={1000}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
              <Button className="w-full" disabled={busy} type="submit">
                {busy ? "جارٍ الإرسال…" : "إرسال للمراجعة"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(review)}
        onOpenChange={(next) => {
          if (!next && !busy) setReview(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{review?.approve ? "تأكيد الموافقة" : "رفض الطلب"}</DialogTitle>
            <DialogDescription>
              {review?.approve
                ? "ستُطبق تغييرات هذا الطلب على المناوبات المرتبطة به."
                : "لن تتغير المناوبات عند رفض الطلب."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={reviewSubmit} className="space-y-4">
            {error && <ErrorState message={error} />}
            <Label htmlFor="review-note">ملاحظة المراجعة (اختياري)</Label>
            <Textarea
              id="review-note"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "جارٍ الحفظ…" : review?.approve ? "تأكيد الموافقة" : "تأكيد الرفض"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
