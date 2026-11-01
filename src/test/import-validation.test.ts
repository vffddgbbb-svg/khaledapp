import { describe, expect, it } from "vitest";
import { readSchedule, resolveSchedule, validDate } from "@/lib/import-validation";
import { refuseOfflineRegistration } from "@/lib/pwa-policy";
describe("Original schedule safety", () => {
  it("rejects duplicate date columns", () => { expect(() => readSchedule("date,date,member,code\n2026-11-01,2026-11-02,test,A", false)).toThrow(); });
  it("rejects ambiguous shift codes", () => { expect(() => resolveSchedule([{ date: "2026-11-01", assignee: "test", code: "A" }], [{ id: "m", full_name: "test" }], [{ id: "t1", code: "A" }, { id: "t2", code: "A" }])).toThrow(); });
  it("rejects more than 2000 assignments", () => { expect(() => resolveSchedule(Array.from({ length: 2001 }, () => ({ date: "2026-11-01", assignee: "test", code: "A" })), [{ id: "m", full_name: "test" }], [{ id: "t", code: "A" }])).toThrow(); });
  it("rejects title-only November 2026 HTML", () => { expect(() => readSchedule("<h1>مناوبات تشرين الثاني 2026</h1>", true)).toThrow(); });
  it("rejects invalid calendar dates", () => { expect(validDate("2026-11-31")).toBe(false); expect(validDate("2026-11-30")).toBe(true); });
  it("rejects missing required columns", () => { expect(() => readSchedule("date,member\n2026-11-01,x", false)).toThrow(); });
  it("deduplicates the same assignment", () => { const row = { date: "2026-11-01", assignee: "test", code: "A" }; expect(resolveSchedule([row,row], [{ id: "m", full_name: "test" }], [{ id: "t", code: "A" }])).toHaveLength(1); });
  it("rejects unmatched names rather than inventing members", () => { expect(() => resolveSchedule([{ date: "2026-11-01", assignee: "missing", code: "A" }], [], [{ id: "t", code: "A" }])).toThrow(); });
});
describe("Offline registration safety", () => {
  it("blocks app-shell service workers on preview", () => { expect(refuseOfflineRegistration("id-preview--f826536b-190c-4e21-a983-b01ac9235739.lovable.app", false, false, false)).toBe(true); });
  it("allows published domain but respects kill switch", () => { expect(refuseOfflineRegistration("khaledapp.lovable.app", false, false, false)).toBe(false); expect(refuseOfflineRegistration("khaledapp.lovable.app", false, false, true)).toBe(true); });
});