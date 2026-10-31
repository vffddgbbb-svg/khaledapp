import { useEffect, useState } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: profile, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    if (profileError || roleError) throw profileError || roleError;
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      fullName: profile?.full_name || u.user.email || "",
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  },
});

export const profilesQuery = queryOptions({
  queryKey: ["profiles"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) throw error;
    return data;
  },
});

export const rolesQuery = queryOptions({
  queryKey: ["roles"],
  queryFn: async () => {
    const { data, error } = await supabase.from("user_roles").select("user_id, role");
    if (error) throw error;
    return data;
  },
});

export const shiftTypesQuery = queryOptions({
  queryKey: ["shift_types"],
  queryFn: async () => {
    const { data, error } = await supabase.from("shift_types").select("*").order("code");
    if (error) throw error;
    return data;
  },
});

export function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endD = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endD).padStart(2, "0")}`;
  return { start, end };
}

export const shiftsMonthQuery = (year: number, month: number) =>
  queryOptions({
    queryKey: ["shifts", year, month],
    queryFn: async () => {
      const { start, end } = monthRange(year, month);
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .gte("shift_date", start)
        .lte("shift_date", end)
        .order("shift_date");
      if (error) throw error;
      return data;
    },
  });

export const swapsQuery = queryOptions({
  queryKey: ["swaps"],
  queryFn: async () => {
    const { data, error } = await supabase.from("swap_requests").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export type SyncStatus = "connecting" | "live" | "offline";

/** Subscribes to live changes and refreshes cached data. Reports real channel state only. */
export function useLiveSync(): SyncStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("connecting");
  useEffect(() => {
    const channel = supabase
      .channel(`live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => {
        qc.invalidateQueries({ queryKey: ["shifts"] });
        qc.invalidateQueries({ queryKey: ["my-upcoming"] });
        qc.invalidateQueries({ queryKey: ["swap-shifts"] });
        qc.invalidateQueries({ queryKey: ["audit"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "swap_requests" }, () =>
        qc.invalidateQueries({ queryKey: ["swaps"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_types" }, () =>
        qc.invalidateQueries({ queryKey: ["shift_types"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { qc.invalidateQueries({ queryKey: ["profiles"] }); qc.invalidateQueries({ queryKey: ["me"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => { qc.invalidateQueries({ queryKey: ["roles"] }); qc.invalidateQueries({ queryKey: ["me"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () => qc.invalidateQueries({ queryKey: ["audit"] }))
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("offline");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
  return status;
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "حدث خطأ غير متوقع";
}

export const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
