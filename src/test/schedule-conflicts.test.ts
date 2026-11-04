import { describe, expect, it } from "vitest";
import { detectImportConflicts } from "@/lib/schedule-conflicts";

const members = [{ id: "member-1", full_name: "Dr A" }];
const types = [
  { id: "night", code: "N", start_time: "22:00:00", end_time: "06:00:00" },
  { id: "day", code: "D", start_time: "05:30:00", end_time: "13:00:00" },
  { id: "evening", code: "E", start_time: "14:00:00", end_time: "18:00:00" },
  { id: "unknown", code: "U", start_time: null, end_time: null },
];

describe("schedule import conflicts", () => {
  it("detects existing exact duplicate by member, date, and shift code", () => {
    const found = detectImportConflicts(
      [{ date: "2026-11-02", assignee: "Dr A", code: "N" }],
      members,
      types,
      [
        {
          shift_date: "2026-11-02",
          member_id: "member-1",
          shift_type_id: "night",
          assignee_label: "Dr A",
        },
      ],
    );
    expect(found.some((conflict) => conflict.kind === "duplicate")).toBe(true);
  });

  it("detects a time overlap and allows known non-overlapping same-day shifts", () => {
    const existing = [
      {
        shift_date: "2026-11-02",
        member_id: "member-1",
        shift_type_id: "night",
        assignee_label: "Dr A",
      },
    ];
    expect(
      detectImportConflicts(
        [{ date: "2026-11-03", assignee: "Dr A", code: "D" }],
        members,
        types,
        existing,
      ),
    ).toContainEqual(expect.objectContaining({ kind: "overlap" }));
    expect(
      detectImportConflicts(
        [{ date: "2026-11-02", assignee: "Dr A", code: "E" }],
        members,
        types,
        existing,
      ),
    ).toEqual([]);
  });

  it("marks unknown times for explicit supervisor review and finds file duplicates", () => {
    const unknown = detectImportConflicts(
      [{ date: "2026-11-02", assignee: "Dr A", code: "U" }],
      members,
      types,
      [
        {
          shift_date: "2026-11-02",
          member_id: "member-1",
          shift_type_id: "night",
          assignee_label: "Dr A",
        },
      ],
    );
    expect(unknown.some((conflict) => conflict.kind === "unverified")).toBe(true);
    const duplicate = detectImportConflicts(
      [
        { date: "2026-11-02", assignee: "Dr A", code: "E", where: "row 2" },
        { date: "2026-11-02", assignee: "Dr A", code: "E", where: "row 3" },
      ],
      members,
      types,
      [],
    );
    expect(duplicate).toContainEqual(
      expect.objectContaining({ kind: "duplicate", location: "row 3" }),
    );
  });
});
