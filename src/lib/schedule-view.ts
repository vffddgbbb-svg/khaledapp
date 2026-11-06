import type { Tables } from "@/integrations/supabase/types";

export function filterShifts(
  shifts: Tables<"shifts">[],
  profiles: Tables<"profiles">[],
  term: string,
  memberId?: string,
) {
  const search = term.trim().toLocaleLowerCase("ar");
  return shifts.filter((shift) => {
    const name =
      profiles.find((profile) => profile.id === shift.member_id)?.full_name || shift.assignee_label;
    return (
      (!memberId || shift.member_id === memberId) &&
      (!search || name.toLocaleLowerCase("ar").includes(search))
    );
  });
}
export function calendarDates(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const length = new Date(year, month, 0).getDate();
  return Array.from({ length: Math.ceil((firstDay + length) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day < 1 || day > length
      ? null
      : `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}
