CREATE UNIQUE INDEX IF NOT EXISTS shifts_label_unique ON public.shifts (shift_date, shift_type_id, assignee_label);
CREATE OR REPLACE FUNCTION public.import_department_schedule(_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE r jsonb; inserted integer := 0; affected integer; d date; dept text; nm text; t uuid; m uuid; colors text[] := ARRAY['sky','coral','mint','sun','grape','rose','slate','ink']; n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'المشرف فقط'; END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 OR jsonb_array_length(_rows) > 3000 THEN RAISE EXCEPTION 'يجب أن يحتوي الملف على 1 إلى 3000 اسم'; END IF;
  PERFORM pg_advisory_xact_lock(7102027);
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF jsonb_typeof(r) <> 'object' OR coalesce(r->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'تاريخ غير صالح'; END IF;
    d := (r->>'date')::date;
    dept := btrim(regexp_replace(coalesce(r->>'department',''), '\s+', ' ', 'g'));
    nm := btrim(regexp_replace(coalesce(r->>'name',''), '\s+', ' ', 'g'));
    IF dept = '' OR nm = '' OR length(dept) > 80 OR length(nm) > 160 THEN RAISE EXCEPTION 'قسم أو اسم غير صالح'; END IF;
    SELECT id INTO t FROM public.shift_types WHERE code = dept;
    IF t IS NULL THEN
      SELECT count(*) INTO n FROM public.shift_types;
      INSERT INTO public.shift_types(code, name, color) VALUES (dept, dept, colors[(n % 8) + 1]) RETURNING id INTO t;
    END IF;
    SELECT CASE WHEN count(*) = 1 THEN min(id::text)::uuid END INTO m FROM public.profiles WHERE btrim(regexp_replace(full_name, '\s+', ' ', 'g')) = nm;
    INSERT INTO public.shifts(shift_date, member_id, assignee_label, shift_type_id, source, created_by)
      VALUES (d, m, nm, t, 'import', auth.uid()) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 0 THEN RAISE EXCEPTION 'رُفض الاستيراد كاملاً: % في % يوم % مسجل مسبقاً أو مكرر', nm, dept, d; END IF;
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END $function$;
REVOKE ALL ON FUNCTION public.import_department_schedule(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_department_schedule(jsonb) TO authenticated;