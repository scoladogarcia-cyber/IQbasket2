-- IQBasket V7 hotfix: allow RLS policies to evaluate the active-account helper for anon.
-- auth.uid() is NULL for anon, so the helper still returns false and exposes no private rows.
begin;
revoke all on function public.iq_account_is_active() from public;
grant execute on function public.iq_account_is_active() to anon, authenticated, service_role;
commit;
