import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FormSelect } from "@/components/form-select";
import { LoadingState } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";
import { displayTrainingYear, TRAINING_YEARS, type TrainingYear } from "@/lib/training-year";

const labels: Record<TrainingYear, string> = {
  "Year 1": "السنة 1",
  "Year 2": "السنة 2",
  "Year 3": "السنة 3",
  "Year 4": "السنة 4",
  Unclassified: "غير مصنّف",
};

type Profile = { id: string; full_name: string };

export function TrainingYearManager({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const classifications = useQuery({
    queryKey: ["training-classification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_training_classification")
        .select("profile_id, training_year, updated_by, updated_at");
      if (error) throw error;
      return data;
    },
  });
  const classificationByProfile = new Map(
    (classifications.data ?? []).map((row) => [row.profile_id, row]),
  );

  async function save(profileId: string, trainingYear: TrainingYear) {
    setSavingId(profileId);
    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) throw userError ?? new Error("انتهت جلسة المستخدم.");
      const { error } = await supabase
        .from("profile_training_classification")
        .upsert(
          { profile_id: profileId, training_year: trainingYear, updated_by: userResult.user.id },
          { onConflict: "profile_id" },
        );
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["training-classification"] });
      toast.success("تم حفظ تصنيف التدريب يدويًا.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التصنيف.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby="training-year-heading">
      <div>
        <h2 id="training-year-heading" className="font-semibold">
          تصنيف سنة التدريب
        </h2>
        <p className="text-sm text-muted-foreground">
          يحدده المشرف يدويًا فقط. غياب التصنيف يعني «غير مصنّف»؛ لا يُستنتج من الاسم أو الدور أو
          المناوبات.
        </p>
      </div>
      {classifications.isPending ? (
        <LoadingState />
      ) : classifications.error ? (
        <p role="alert" className="text-sm text-destructive">
          تعذر تحميل التصنيفات. تحقق من تطبيق migration وصلاحيات قاعدة البيانات.
        </p>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا يوجد أعضاء لعرضهم.</p>
      ) : (
        <ul className="divide-y">
          {profiles.map((profile) => {
            const row = classificationByProfile.get(profile.id);
            const selected = displayTrainingYear(row?.training_year);
            return (
              <li
                key={profile.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="min-w-32 text-sm font-medium">
                  {profile.full_name || "عضو بدون اسم"}
                </span>
                <FormSelect
                  className="max-w-48"
                  aria-label={`سنة تدريب ${profile.full_name || "العضو"}`}
                  value={selected}
                  disabled={!currentUserId || savingId !== null}
                  onChange={(event) => void save(profile.id, event.target.value as TrainingYear)}
                >
                  {TRAINING_YEARS.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </FormSelect>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
