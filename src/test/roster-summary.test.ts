import { describe, expect, it } from "vitest";
import { rosterSummary, TRAINING_GROUPS } from "@/lib/roster-summary";

describe("real-data roster summary", () => {
  const shift = {
    member_id: null,
    assignee_label: "اسم اختبار وحدات",
    shift_type_id: "d",
    shift_date: "2026-11-01",
  };
  it("keeps four training years and unclassified without guessing from names", () => {
    expect(TRAINING_GROUPS.map((g) => g.key)).toEqual(["1", "2", "3", "4", "unclassified"]);
    const result = rosterSummary([{ ...shift, assignee_label: "السنة الرابعة" }], []);
    expect(result.people).toEqual([
      { key: "label:السنة الرابعة", name: "السنة الرابعة", assignments: 1 },
    ]);
  });
  it("counts assignments, unique label identities, active departments and days", () => {
    const result = rosterSummary(
      [shift, shift, { ...shift, shift_date: "2026-11-02", shift_type_id: "e" }],
      [],
    );
    expect(result.assignments).toBe(3);
    expect(result.people).toHaveLength(1);
    expect(result.people[0]?.assignments).toBe(3);
    expect(result.departments).toBe(2);
    expect(result.days).toBe(2);
  });
  it("does not merge distinct accounts with the same name or count unnamed assignments as people", () => {
    const result = rosterSummary(
      [
        { ...shift, member_id: "a" },
        { ...shift, member_id: "b" },
        { ...shift, assignee_label: "" },
      ],
      [
        { id: "a", full_name: "نفس الاسم" },
        { id: "b", full_name: "نفس الاسم" },
      ],
    );
    expect(result.people).toHaveLength(2);
    expect(result.unnamed).toBe(1);
  });
});
