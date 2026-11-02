CREATE OR REPLACE FUNCTION public.import_schedule(_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  r jsonb;
  inserted integer := 0;
  affected integer;
  d date;
  m uuid;
  t uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'المشرف فقط';
  END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN
    RAISE EXCEPTION 'ملف غير صالح';
  END IF;
  IF jsonb_array_length(_rows) = 0 OR jsonb_array_length(_rows) > 2000 THEN
    RAISE EXCEPTION 'يجب أن يحتوي الملف على 1 إلى 2000 مناوبة';
  END IF;

  PERFORM pg_advisory_xact_lock(7102027);
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF jsonb_typeof(r) <> 'object' OR coalesce(r->>'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'تاريخ غير صالح؛ استخدم YYYY-MM-DD';
    END IF;
    d := (r->>'date')::date;
    m := (r->>'memberId')::uuid;
    t := (r->>'typeId')::uuid;
    IF m IS NULL OR t IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = m)
      OR NOT EXISTS (SELECT 1 FROM public.shift_types WHERE id = t) THEN
      RAISE EXCEPTION 'عضو أو نوع مناوبة غير موجود';
    END IF;

    INSERT INTO public.shifts(shift_date, member_id, assignee_label, shift_type_id, source, created_by)
      SELECT d, m, full_name, t, 'import', auth.uid()
      FROM public.profiles WHERE id = m
      ON CONFLICT (shift_date, member_id, shift_type_id) DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 0 THEN
      RAISE EXCEPTION 'رُفض الاستيراد كاملاً: توجد مناوبة مسجلة مسبقاً أو تكرار داخل الملف';
    END IF;
    inserted := inserted + affected;
  END LOOP;
  RETURN inserted;
END
$function$;

REVOKE ALL ON FUNCTION public.import_schedule(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_schedule(jsonb) TO authenticated;
