export const TRAINING_GROUPS = [
  { key: "1", label: "السنة الأولى" },
  { key: "2", label: "السنة الثانية" },
  { key: "3", label: "السنة الثالثة" },
  { key: "4", label: "السنة الرابعة" },
  { key: "unclassified", label: "غير مصنف" },
] as const;

type Shift = {
  member_id: string | null;
  assignee_label: string;
  shift_type_id: string | null;
  shift_date: string;
};
type Profile = { id: string; full_name: string };

/** Training years are unavailable in the connected schema; never derive them from names. */
export function rosterSummary(shifts: Shift[], profiles: Profile[]) {
  const profileNames = new Map(profiles.map((p) => [p.id, p.full_name]));
  const people = new Map<string, { key: string; name: string; assignments: number }>();
  let unnamed = 0;
  for (const shift of shifts) {
    const name = (profileNames.get(shift.member_id ?? "") || shift.assignee_label)
      .replace(/\s+/g, " ")
      .trim();
    if (!name) {
      unnamed++;
      continue;
    }
    const key = shift.member_id ? `profile:${shift.member_id}` : `label:${name}`;
    const person = people.get(key) ?? { key, name, assignments: 0 };
    person.assignments++;
    people.set(key, person);
  }
  return {
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "ar")),
    assignments: shifts.length,
    departments: new Set(shifts.map((s) => s.shift_type_id).filter(Boolean)).size,
    days: new Set(shifts.map((s) => s.shift_date)).size,
    unnamed,
  };
}
