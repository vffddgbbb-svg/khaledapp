import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeEqual } from "@/lib/schedule-import";

const accountSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(10).max(128),
  fullName: z.string().trim().min(2).max(100),
});

/** Whether the server has a setup token configured (never returns the token). */
export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("user_roles").select("id").eq("role", "admin").limit(1);
  if (error) throw new Error("تعذر التحقق من الإعداد. تواصل مع مالك المشروع.");
  return {
    tokenConfigured: Boolean(process.env["ADMIN_SETUP_TOKEN"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]),
    adminExists: (data?.length ?? 0) > 0,
  };
});

/** One-time admin claim: requires ADMIN_SETUP_TOKEN and that no admin exists yet. */
export const claimAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => accountSchema.extend({ token: z.string().min(1).max(256) }).parse(input))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_SETUP_TOKEN"];
    if (!expected) throw new Error("لم يتم ضبط رمز الإعداد على الخادم بعد.");
    if (!safeEqual(data.token, expected)) throw new Error("رمز الإعداد غير صحيح.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("user_roles").select("id").eq("role", "admin").limit(1);
    if (existing && existing.length > 0) throw new Error("تمت المطالبة بحساب المشرف مسبقاً.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "تعذر إنشاء الحساب");

    const { error: roleErr } = await supabaseAdmin.rpc("claim_initial_admin", { _user_id: created.user.id });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleErr.message);
    }
    await supabaseAdmin.from("audit_log").insert({
      actor_id: created.user.id,
      action: "claim_admin",
      entity: "user_roles",
      entity_id: created.user.id,
      details: { email: data.email },
    });
    return { ok: true };
  });

async function assertAdmin(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("غير مصرح: هذه العملية للمشرف فقط.");
}

/** Admin-only: create a member account with a temporary password. */
export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => accountSchema.extend({ role: z.literal("member").default("member") }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "تعذر إنشاء الحساب");
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "member" });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("تعذر إكمال إنشاء العضو.");
    }
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "create_member",
      entity: "profiles",
      entity_id: created.user.id,
      details: { email: data.email, full_name: data.fullName, role: data.role },
    });
    return { id: created.user.id };
  });

/** Admin-only: remove a member account. */
export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك الخاص.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", data.userId).maybeSingle();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "delete_member",
      entity: "profiles",
      entity_id: data.userId,
      details: prof ?? {},
    });
    return { ok: true };
  });
