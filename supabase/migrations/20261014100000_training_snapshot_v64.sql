-- Safety snapshot for training migration; private schema, no API grants.
begin;
create schema if not exists iqbasket_recovery_20261014;
create table if not exists iqbasket_recovery_20261014.training_sessions as select * from public.training_sessions;
create table if not exists iqbasket_recovery_20261014.training_participants as select * from public.training_participants;
create table if not exists iqbasket_recovery_20261014.training_blocks as select * from public.training_blocks;
create table if not exists iqbasket_recovery_20261014.training_block_participation as select * from public.training_block_participation;
create table if not exists iqbasket_recovery_20261014.external_development_sessions as select * from public.external_development_sessions;
comment on schema iqbasket_recovery_20261014 is 'Internal pre-V64 recovery snapshot, not exposed to PostgREST.';
commit;
