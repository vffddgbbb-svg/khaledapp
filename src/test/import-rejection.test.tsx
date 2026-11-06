// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduleImporter } from "@/components/schedule-importer";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/lib/app-data", () => ({
  profilesQuery: { queryKey: ["profiles"], queryFn: async () => [] },
  shiftTypesQuery: { queryKey: ["types"], queryFn: async () => [{ id: "d", code: "جناح" }] },
  errMsg: (e: Error) => e.message,
  AR_MONTHS: Array.from({ length: 12 }, (_, i) => `شهر ${i + 1}`),
  monthRange: () => ({ start: "2026-11-01", end: "2026-11-30" }),
  fetchShiftsRange: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("importer refuses source data loss before any RPC", () => {
  it.each([
    ["departments", "اليوم,التاريخ,جناح,\nالأحد,2026-11-01,اسم اختبار,خلية مفقودة"],
    ["flat", "date,member,code,\n2026-11-01,اسم اختبار,جناح,خلية مفقودة"],
    ["members-rows", "الاسم,1,\nاسم اختبار,جناح,خلية مفقودة"],
  ])("blocks %s input with a nonempty unheaded cell", async (mode, text) => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ScheduleImporter />
      </QueryClientProvider>,
    );
    const input = screen.getByLabelText("ملف الجدول");
    await waitFor(() => expect(input).not.toBeDisabled());
    const file = new File([text], "unit-only.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => text });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByLabelText("شكل الجدول");
    fireEvent.change(screen.getByLabelText("شكل الجدول"), { target: { value: mode } });
    if (mode !== "flat") {
      fireEvent.change(screen.getByLabelText("السنة"), { target: { value: "2026" } });
      fireEvent.change(screen.getByLabelText("الشهر"), { target: { value: "11" } });
    }
    const confirm = screen.getByRole("button", { name: "تأكيد الاستيراد" });
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    expect(rpc).not.toHaveBeenCalled();
  });
});
