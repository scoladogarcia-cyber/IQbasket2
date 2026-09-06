from pathlib import Path

path = Path("supabase/migrations/20260906202000_family_profile_controls_v1.sql")
text = path.read_text(encoding="utf-8")
old = "valid_until=coalesce(r.valid_until,now()),"
new = "valid_until=coalesce(r.valid_until,greatest(now(),r.valid_from + interval '1 microsecond'))," 
count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly one unsafe valid_until assignment, found {count}")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")

updated = path.read_text(encoding="utf-8")
if old in updated:
    raise SystemExit("Unsafe valid_until assignment still present")
if new not in updated:
    raise SystemExit("Safe valid_until assignment missing")
print("V26_GUARDIAN_TIME_INVARIANT_OK")
