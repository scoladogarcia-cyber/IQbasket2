-- IQ Basket · Auditoría Supabase SOLO LECTURA
-- No crea, modifica ni elimina datos.
-- Ejecutar en Supabase SQL Editor antes de cualquier limpieza/migración.

-- 1) Inventario de tablas y estimación de filas
select
  schemaname,
  relname as table_name,
  n_live_tup as estimated_rows,
  n_dead_tup as estimated_dead_rows,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
order by relname;

-- 2) Columnas, tipos, nullability y defaults
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3) Claves primarias, únicas y foreign keys
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.table_schema = ccu.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4) Índices
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 5) Estado RLS
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 6) Policies RLS
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 7) Funciones/RPC públicas (firma y seguridad)
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  l.lanname as language
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname;

-- 8) Distribución actual de roles
select
  upper(coalesce(role, 'NULL')) as role,
  count(*) as users
from public.user_profiles
group by upper(coalesce(role, 'NULL'))
order by users desc, role;

-- 9) Comprobación crítica: Superadmins
select
  id,
  email,
  role
from public.user_profiles
where upper(coalesce(role, '')) = 'SUPERADMIN'
order by lower(email);

-- 10) Emails duplicados en perfiles
select
  lower(email) as normalized_email,
  count(*) as occurrences
from public.user_profiles
where email is not null
group by lower(email)
having count(*) > 1
order by occurrences desc, normalized_email;

-- 11) Equipos huérfanos de club
select
  t.id,
  t.name,
  t.club_id
from public.teams t
left join public.clubs c on c.id = t.club_id
where t.club_id is not null
  and c.id is null;

-- 12) Jugadores huérfanos de equipo
select
  p.id,
  p.first_name,
  p.last_name,
  p.team_id
from public.players p
left join public.teams t on t.id = p.team_id
where p.team_id is not null
  and t.id is null;

-- 13) Partidos huérfanos de equipo
select
  g.id,
  g.date,
  g.opponent,
  g.team_id
from public.games g
left join public.teams t on t.id = g.team_id
where g.team_id is not null
  and t.id is null;

-- 14) Partidos con season_id inexistente
select
  g.id,
  g.date,
  g.opponent,
  g.season_id
from public.games g
left join public.seasons s on s.id = g.season_id
where g.season_id is not null
  and s.id is null;

-- 15) Posibles temporadas duplicadas por equipo/nombre
select
  team_id,
  lower(trim(name)) as normalized_name,
  count(*) as occurrences,
  array_agg(id order by created_at) as season_ids
from public.seasons
group by team_id, lower(trim(name))
having count(*) > 1
order by occurrences desc;

-- 16) Posibles equipos duplicados por club/nombre
select
  club_id,
  lower(trim(name)) as normalized_name,
  count(*) as occurrences,
  array_agg(id) as team_ids
from public.teams
group by club_id, lower(trim(name))
having count(*) > 1
order by occurrences desc;

-- 17) Tamaño físico de las tablas
select
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_size_pretty(pg_relation_size(relid)) as table_size,
  pg_size_pretty(pg_indexes_size(relid)) as indexes_size
from pg_catalog.pg_statio_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;
