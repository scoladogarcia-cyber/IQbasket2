-- Emergency rollback for V19 Early Adopter Feedback V1.
begin;

drop function if exists public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb);
drop function if exists iq_private.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb);
drop table if exists public.product_feedback;

commit;
