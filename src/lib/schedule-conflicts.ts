import type { ScheduleRow } from "@/lib/import-validation";

type Member = { id: string; full_name: string };
type ShiftType = { id: string; code: string; start_time: string | null; end_time: string | null };
type ExistingShift = {
  shift_date: string;
  member_id: string | null;
  shift_type_id: string | null;
  assignee_label: string;
};

export type ImportConflict = {
  kind: "duplicate" | "overlap" | "unverified";
  location: string;
  message: string;
};

const norm = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();

function minuteOfDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function interval(date: string, type: ShiftType | undefined): [number, number] | null {
  if (!type) return null;
  const start = minuteOfDay(type.start_time);
  const end = minuteOfDay(type.end_time);
  if (start === null || end === null) return null;
  const day = Date.parse(`${date}T00:00:00Z`) / 60_000;
  if (!Number.isFinite(day)) return null;
  const startAt = day + start;
  let endAt = day + end;
  if (end <= start) endAt += 24 * 60;
  return [startAt, endAt];
}

function overlaps(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1];
}

/**
 * Compares source rows to stored shifts without mutating them. An exact duplicate or
 * proven time overlap blocks commit; unknown shift times are surfaced for explicit
 * supervisor acknowledgement rather than silently treated as safe.
 */
export function detectImportConflicts(
  rows: ScheduleRow[],
  members: Member[],
  types: ShiftType[],
  existing: ExistingShift[],
): ImportConflict[] {
  const memberByName = new Map<string, Member[]>();
  for (const member of members) {
    const key = norm(member.full_name);
    memberByName.set(key, [...(memberByName.get(key) ?? []), member]);
  }
  const typeByCode = new Map<string, ShiftType[]>();
  const typeById = new Map(types.map((type) => [type.id, type]));
  for (const type of types) {
    const key = norm(type.code);
    typeByCode.set(key, [...(typeByCode.get(key) ?? []), type]);
  }

  const conflicts: ImportConflict[] = [];
  const seen = new Map<string, ScheduleRow>();
  const fileAssignments: {
    personKey: string;
    row: ScheduleRow;
    interval: [number, number] | null;
  }[] = [];
  for (const row of rows) {
    const location = row.where ?? `${row.date} · ${row.assignee}`;
    const matchedMembers = memberByName.get(norm(row.assignee)) ?? [];
    const member = matchedMembers.length === 1 ? matchedMembers[0] : undefined;
    const matchedTypes = typeByCode.get(norm(row.code)) ?? [];
    const type = matchedTypes.length === 1 ? matchedTypes[0] : undefined;
    const personKey = member?.id ?? `label:${norm(row.assignee)}`;
    const rowKey = `${row.date}|${personKey}|${type?.id ?? `code:${norm(row.code)}`}`;
    const previous = seen.get(rowKey);
    if (previous) {
      conflicts.push({
        kind: "duplicate",
        location,
        message: `مكرر داخل الملف مع ${previous.where ?? previous.date}.`,
      });
      continue;
    }
    seen.set(rowKey, row);
    const candidateInterval = interval(row.date, type);
    for (const prior of fileAssignments) {
      if (prior.personKey !== personKey) continue;
      if (candidateInterval && prior.interval && overlaps(candidateInterval, prior.interval)) {
        conflicts.push({
          kind: "overlap",
          location,
          message: `تتداخل هذه المناوبة مع صف آخر في الملف (${prior.row.where ?? prior.row.date}).`,
        });
      } else if (!candidateInterval || !prior.interval) {
        const delta = Math.abs(
          Date.parse(`${prior.row.date}T00:00:00Z`) - Date.parse(`${row.date}T00:00:00Z`),
        );
        if (delta <= 86_400_000) {
          conflicts.push({
            kind: "unverified",
            location,
            message: `لدى العضو مناوبة قريبة في الملف (${prior.row.where ?? prior.row.date}) لكن أوقات المناوبة غير مكتملة.`,
          });
        }
      }
    }
    fileAssignments.push({ personKey, row, interval: candidateInterval });
    const matchingExisting = existing.filter((stored) => {
      const sameMember = member
        ? stored.member_id === member.id ||
          (!stored.member_id && norm(stored.assignee_label) === norm(row.assignee))
        : norm(stored.assignee_label) === norm(row.assignee);
      return sameMember;
    });

    for (const stored of matchingExisting) {
      const storedType = typeById.get(stored.shift_type_id ?? "");
      const sameType = storedType
        ? norm(storedType.code) === norm(row.code)
        : norm(row.code) === "";
      if (stored.shift_date === row.date && sameType) {
        conflicts.push({
          kind: "duplicate",
          location,
          message: `موجود مسبقًا في ${row.date} بنفس العضو ورمز المناوبة.`,
        });
        continue;
      }

      const storedInterval = interval(stored.shift_date, storedType);
      if (!candidateInterval || !storedInterval) {
        const sameDay = stored.shift_date === row.date;
        const adjacentDay =
          Math.abs(
            Date.parse(`${stored.shift_date}T00:00:00Z`) - Date.parse(`${row.date}T00:00:00Z`),
          ) <= 86_400_000;
        if (sameDay || adjacentDay) {
          conflicts.push({
            kind: "unverified",
            location,
            message: `لدى العضو مناوبة قريبة (${stored.shift_date}) لكن أوقات إحدى المناوبتين غير محددة؛ يلزم تحقق المشرف.`,
          });
        }
      } else if (overlaps(candidateInterval, storedInterval)) {
        conflicts.push({
          kind: "overlap",
          location,
          message: `تداخل زمني مع مناوبة قائمة بتاريخ ${stored.shift_date}.`,
        });
      }
    }
  }

  return conflicts.filter(
    (conflict, index, all) =>
      all.findIndex(
        (other) =>
          other.kind === conflict.kind &&
          other.location === conflict.location &&
          other.message === conflict.message,
      ) === index,
  );
}
