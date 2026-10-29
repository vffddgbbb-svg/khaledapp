
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.swap_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

CREATE POLICY "Signed-in users read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Auto profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Shift types
CREATE TABLE public.shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'sky',
  start_time time,
  end_time time,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_types TO authenticated;
GRANT ALL ON public.shift_types TO service_role;
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read shift types" ON public.shift_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage shift types" ON public.shift_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shifts
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date date NOT NULL,
  member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_label text NOT NULL DEFAULT '',
  shift_type_id uuid REFERENCES public.shift_types(id) ON DELETE SET NULL,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  import_batch text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shifts_date_idx ON public.shifts (shift_date);
CREATE INDEX shifts_member_idx ON public.shifts (member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage shifts" ON public.shifts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Swap requests
CREATE TABLE public.swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  target_member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
  reason text,
  status public.swap_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.swap_requests TO authenticated;
GRANT ALL ON public.swap_requests TO service_role;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin swaps" ON public.swap_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_member_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members create own swap" ON public.swap_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id AND status = 'pending' AND reviewed_by IS NULL
    AND requester_id <> target_member_id
    AND EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = requester_shift_id AND s.member_id = auth.uid())
    AND (target_shift_id IS NULL OR EXISTS (SELECT 1 FROM public.shifts s WHERE s.id = target_shift_id AND s.member_id = target_member_id))
  );

-- Audit log
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON public.audit_log (created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec jsonb; old_rec jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN old_rec := to_jsonb(OLD); END IF;
  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, rec->>'id',
    jsonb_build_object('new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE rec END, 'old', CASE WHEN TG_OP = 'INSERT' THEN NULL WHEN TG_OP = 'DELETE' THEN rec ELSE old_rec END));
  RETURN NULL;
END $$;

CREATE TRIGGER audit_shifts AFTER INSERT OR UPDATE OR DELETE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_shift_types AFTER INSERT OR UPDATE OR DELETE ON public.shift_types FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_swaps AFTER INSERT OR UPDATE OR DELETE ON public.swap_requests FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER shifts_touch BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Review swap (admin only)
CREATE OR REPLACE FUNCTION public.review_swap(_request_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.swap_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'غير مصرح: المشرف فقط يمكنه مراجعة الطلبات'; END IF;
  SELECT * INTO r FROM public.swap_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'تمت مراجعة هذا الطلب مسبقاً'; END IF;
  IF _approve THEN
    UPDATE public.shifts SET member_id = r.target_member_id,
      assignee_label = COALESCE((SELECT full_name FROM public.profiles WHERE id = r.target_member_id), '')
      WHERE id = r.requester_shift_id;
    IF r.target_shift_id IS NOT NULL THEN
      UPDATE public.shifts SET member_id = r.requester_id,
        assignee_label = COALESCE((SELECT full_name FROM public.profiles WHERE id = r.requester_id), '')
        WHERE id = r.target_shift_id;
    END IF;
  END IF;
  UPDATE public.swap_requests SET status = CASE WHEN _approve THEN 'approved'::public.swap_status ELSE 'rejected'::public.swap_status END,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note WHERE id = _request_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_swap(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_swap(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_swap(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.swap_requests SET status = 'cancelled'
  WHERE id = _request_id AND requester_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'لا يمكن إلغاء هذا الطلب'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.cancel_swap(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_swap(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.swap_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_types;
