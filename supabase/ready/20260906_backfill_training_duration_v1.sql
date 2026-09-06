begin;

-- Deterministic repair for legacy rows created before canonical duration was
-- enforced. No IDs are hardcoded; the value is derived only from stored times.
update public.training_sessions
set duration_minutes = round(extract(epoch from (end_time - start_time)) / 60.0)::integer,
    updated_at = now()
where start_time is not null
  and end_time is not null
  and end_time > start_time
  and duration_minutes is distinct from round(extract(epoch from (end_time - start_time)) / 60.0)::integer;

commit;
