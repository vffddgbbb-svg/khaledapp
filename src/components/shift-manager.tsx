import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/form-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/states";
import { profilesQuery, shiftTypesQuery, shiftsMonthQuery, errMsg } from "@/lib/app-data";
import { validDate } from "@/lib/import-validation";
import { supabase } from "@/integrations/supabase/client";

const empty = { id: "", date: "", member: "", type: "", notes: "" };

export function ShiftManager() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState(empty);
  const [remove, setRemove] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const members = useQuery(profilesQuery);
  const types = useQuery(shiftTypesQuery);
  const [year, monthNumber] = month.split("-").map(Number);
  const shifts = useQuery(shiftsMonthQuery(year || 2026, monthNumber || 1));
  const qc = useQueryClient();

  async function refresh() {
    await Promise.all(
      ["shifts", "swap-shifts", "my-upcoming", "audit"].map((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      ),
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!validDate(form.date)) {
      setError("تاريخ غير صالح.");
      return;
    }
    setBusy(true);
    try {
      const { error: failure } = await supabase.rpc("save_shift", {
        _date: form.date,
        _member_id: form.member,
        _type_id: form.type,
        _notes: form.notes.trim(),
        ...(form.id ? { _shift_id: form.id } : {}),
      });
      if (failure) throw failure;
      setMonth(form.date.slice(0, 7));
      await refresh();
      setMessage(form.id ? "حُفظ تعديل المناوبة." : "أُضيفت المناوبة.");
      setForm(empty);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteShift() {
    if (!remove) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: failure } = await supabase
        .from("shifts")
        .delete()
        .eq("id", remove)
        .select("id")
        .single();
      if (failure) throw failure;
      if (form.id === remove) setForm(empty);
      await refresh();
      setRemove("");
      setMessage("حُذفت المناوبة.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const dataError = members.error || types.error || shifts.error;
  return (
    <section className="space-y-5 border-t py-6">
      <h2 className="text-xl font-bold">المناوبات وإسنادها</h2>
      {error && !remove && <ErrorState message={error} />}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {dataError ? (
        <ErrorState message={errMsg(dataError)} />
      ) : (
        <>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shift-date">التاريخ</Label>
              <Input
                id="shift-date"
                type="date"
                required
                disabled={busy}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-member">العضو</Label>
              <FormSelect
                id="shift-member"
                required
                disabled={busy}
                value={form.member}
                onChange={(e) => setForm({ ...form, member: e.target.value })}
              >
                <option value="">اختر العضو</option>
                {members.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-type">نوع المناوبة</Label>
              <FormSelect
                id="shift-type"
                required
                disabled={busy}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="">اختر النوع</option>
                {types.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="shift-notes"
                maxLength={1000}
                disabled={busy}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !members.data?.length || !types.data?.length}>
                <Plus />
                {busy ? "جارٍ الحفظ…" : form.id ? "حفظ التعديل" : "حفظ المناوبة"}
              </Button>
              {form.id && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setForm(empty)}
                >
                  <X />
                  إلغاء
                </Button>
              )}
            </div>
          </form>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="manage-month">شهر المناوبات</Label>
            <Input
              id="manage-month"
              type="month"
              required
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </div>
          {shifts.isPending ? (
            <LoadingState />
          ) : shifts.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مناوبات مسجلة لهذا الشهر.</p>
          ) : (
            <div className="divide-y border-y">
              {shifts.data?.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 text-sm">
                    <p dir="ltr" className="text-right">
                      {s.shift_date}
                    </p>
                    <p className="break-words font-semibold">
                      {members.data?.find((m) => m.id === s.member_id)?.full_name ||
                        s.assignee_label}{" "}
                      · {types.data?.find((t) => t.id === s.shift_type_id)?.name ?? "نوع غير محدد"}
                    </p>
                    {s.notes && <p className="break-words text-muted-foreground">{s.notes}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`تعديل مناوبة ${s.shift_date}`}
                      title="تعديل المناوبة"
                      onClick={() => {
                        setError("");
                        setMessage("");
                        setForm({
                          id: s.id,
                          date: s.shift_date,
                          member: s.member_id ?? "",
                          type: s.shift_type_id ?? "",
                          notes: s.notes ?? "",
                        });
                        document.getElementById("shift-date")?.focus();
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`حذف مناوبة ${s.shift_date}`}
                      title="حذف المناوبة"
                      onClick={() => {
                        setError("");
                        setRemove(s.id);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <Dialog
        open={Boolean(remove)}
        onOpenChange={(open) => {
          if (!open && !busy) setRemove("");
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف المناوبة؟</DialogTitle>
            <DialogDescription>
              ستُحذف المناوبة وطلبات التبديل المرتبطة بها، ويبقى أثر الحذف في سجل التدقيق.
            </DialogDescription>
          </DialogHeader>
          {error && <ErrorState message={error} />}
          <Button variant="destructive" disabled={busy} onClick={deleteShift}>
            تأكيد حذف المناوبة
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
