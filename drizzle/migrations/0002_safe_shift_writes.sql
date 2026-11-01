CREATE UNIQUE INDEX IF NOT EXISTS shifts_assignment_unique ON public.shifts (shift_date, member_id, shift_type_id);
CREATE OR REPLACE FUNCTION public.save_shift(_date date, _member_id uuid, _type_id uuid, _notes text DEFAULT NULL, _shift_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $function$
DECLARE saved uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'المشرف فقط'; END IF;
  IF _date IS NULL OR _member_id IS NULL OR _type_id IS NULL THEN RAISE EXCEPTION 'التاريخ والعضو والنوع مطلوبة'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _member_id) OR NOT EXISTS (SELECT 1 FROM public.shift_types WHERE id = _type_id) THEN RAISE EXCEPTION 'عضو أو نوع مناوبة غير موجود'; END IF;
  IF length(coalesce(_notes,'')) > 1000 THEN RAISE EXCEPTION 'الملاحظات تتجاوز 1000 حرف'; END IF;
  IF _shift_id IS NULL THEN
    INSERT INTO public.shifts (shift_date, member_id, shift_type_id, assignee_label, notes, source, created_by)
    SELECT _date, _member_id, _type_id, full_name, nullif(btrim(_notes),''), 'manual', auth.uid() FROM public.profiles WHERE id = _member_id RETURNING id INTO saved;
  ELSE
    UPDATE public.shifts SET shift_date = _date, member_id = _member_id, shift_type_id = _type_id, assignee_label = (SELECT full_name FROM public.profiles WHERE id = _member_id), notes = nullif(btrim(_notes),'') WHERE id = _shift_id RETURNING id INTO saved;
    IF saved IS NULL THEN RAISE EXCEPTION 'المناوبة غير موجودة أو غير متاحة'; END IF;
  END IF;
  RETURN saved;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'هذه المناوبة مسجلة بالفعل لهذا العضو والتاريخ والنوع';
END $function$;
REVOKE ALL ON FUNCTION public.save_shift(date,uuid,uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_shift(date,uuid,uuid,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.import_schedule(_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE r jsonb; inserted integer := 0; affected integer; d date; m uuid; t uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'المشرف فقط'; END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN RAISE EXCEPTION 'ملف غير صالح'; END IF;
  IF jsonb_array_length(_rows) = 0 OR jsonb_array_length(_rows) > 2000 THEN RAISE EXCEPTION 'يجب أن يحتوي الملف على 1 إلى 2000 مناوبة'; END IF;
  PERFORM pg_advisory_xact_lock(7102027);
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF jsonb_typeof(r) <> 'object' OR coalesce(r->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'تاريخ غير صالح؛ استخدم YYYY-MM-DD'; END IF;
    d := (r->>'date')::date; m := (r->>'memberId')::uuid; t := (r->>'typeId')::uuid;
    IF m IS NULL OR t IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=m) OR NOT EXISTS (SELECT 1 FROM public.shift_types WHERE id=t) THEN RAISE EXCEPTION 'عضو أو نوع مناوبة غير موجود'; END IF;
    INSERT INTO public.shifts(shift_date,member_id,assignee_label,shift_type_id,source,created_by)
      SELECT d,m,full_name,t,'import',auth.uid() FROM public.profiles WHERE id=m
      ON CONFLICT (shift_date,member_id,shift_type_id) DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT; inserted := inserted + affected;
  END LOOP;
  RETURN inserted;
END $function$;
REVOKE ALL ON FUNCTION public.import_schedule(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_schedule(jsonb) TO authenticated;
ALTER POLICY "Admins update profiles" ON public.profiles WITH CHECK (public.has_role(auth.uid(),'admin'));