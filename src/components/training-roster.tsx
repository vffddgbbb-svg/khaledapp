import { rosterSummary, TRAINING_GROUPS } from "@/lib/roster-summary";
import type { Tables } from "@/integrations/supabase/types";

export function TrainingRoster({
  shifts,
  profiles,
}: {
  shifts: Tables<"shifts">[];
  profiles: Tables<"profiles">[];
}) {
  const summary = rosterSummary(shifts, profiles);
  return (
    <section className="mb-6 border-y py-5" aria-label="إحصاءات وتصنيف الفريق">
      <h2 className="mb-3 text-lg font-bold">الفريق حسب سنة التدريب</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        سنة التدريب غير مسجلة في البيانات الحالية؛ تُعرض الأسماء ضمن «غير مصنف» دون استنتاج من
        الاسم.
      </p>
      <dl className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "أسماء أو حسابات في النتائج", value: summary.people.length },
          { label: "تكليفات في النتائج", value: summary.assignments },
          { label: "أقسام في النتائج", value: summary.departments },
          { label: "أيام لها تكليفات", value: summary.days },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 text-xl font-bold">{item.value.toLocaleString("ar")}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TRAINING_GROUPS.map((group) => (
          <div key={group.key} className="min-w-0 border-t pt-3">
            <h3 className="text-sm font-semibold">{group.label}</h3>
            {group.key !== "unclassified" ? (
              <p className="mt-2 text-xs text-muted-foreground">لا يوجد تصنيف مسجل</p>
            ) : (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer">
                  {summary.people.length.toLocaleString("ar")} اسم / حساب
                </summary>
                <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
                  {summary.people.map((person) => (
                    <li key={person.key} className="break-words">
                      <span>{person.name}</span>
                      <span className="mr-2 text-xs text-muted-foreground">
                        {person.assignments.toLocaleString("ar")} تكليف
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
      {summary.unnamed > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {summary.unnamed.toLocaleString("ar")} تكليف دون اسم، غير مشمول بعدد الأسماء.
        </p>
      )}
    </section>
  );
}
