-- IQBasket v3 RLS model (DRAFT / ROLLBACK ONLY)
-- -----------------------------------------------------------------------------
-- DO NOT DEPLOY YET.
--
-- Purpose:
--   * replace permissive/public legacy policies;
--   * authorize by authenticated user + team-season scope;
--   * keep global security role separate from contextual sporting function;
--   * deny unscoped reads of player/game/statistical data;
--   * preserve a public read-only path only for translations.
--
-- Prerequisites:
--   1) v3 structure exists;
--   2) roster + memberships are backfilled;
--   3) application reads team_season_id;
--   4) access RPCs are deployed;
--   5) full backup + validation completed.
--
-- The whole file is transactional and ends in ROLLBACK.
-- -----------------------------------------------------------------------------

begin;

-- ============================================================================
-- 1. AUTHORIZATION HELPERS
-- ============================================================================

create or replace function public.iq_v3_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and lower(up.email) = 'scolado@nechigroup.com'
          and upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
    );
$$;

create or replace function public.iq_v3_global_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when public.iq_v3_is_superadmin() then 'SUPERADMIN'
        else upper(coalesce(up.global_role, 'USER'))
    end
    from public.user_profiles up
    where up.id = auth.uid();
$$;

create or replace function public.iq_v3_has_team_season_access(
    target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = target_team_season_id
              and upper(m.status) = 'ACTIVE'
        )
        or exists (
            select 1
            from public.team_seasons ts
            join public.teams t on t.id = ts.team_id
            join public.club_season_memberships cm
              on cm.club_id = t.club_id
             and cm.season_id = ts.season_id
            where ts.id = target_team_season_id
              and cm.user_id = auth.uid()
              and upper(cm.status) = 'ACTIVE'
        );
$$;

create or replace function public.iq_v3_has_team_season_role(
    target_team_season_id uuid,
    allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = target_team_season_id
              and upper(m.status) = 'ACTIVE'
              and upper(m.function_role) = any (
                    select upper(x)
                    from unnest(allowed_roles) as x
              )
        )
        or exists (
            select 1
            from public.team_seasons ts
            join public.teams t on t.id = ts.team_id
            join public.club_season_memberships cm
              on cm.club_id = t.club_id
             and cm.season_id = ts.season_id
            where ts.id = target_team_season_id
              and cm.user_id = auth.uid()
              and upper(cm.status) = 'ACTIVE'
              and upper(cm.function_role) = any (
                    select upper(x)
                    from unnest(allowed_roles) as x
              )
        );
$$;

create or replace function public.iq_v3_can_manage_club(
    target_club_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.club_season_memberships cm
            where cm.user_id = auth.uid()
              and cm.club_id = target_club_id
              and upper(cm.status) = 'ACTIVE'
              and upper(cm.function_role) in (
                  'ADMIN',
                  'COORDINADOR',
                  'DIRECTOR_DEPORTIVO'
              )
        );
$$;

create or replace function public.iq_v3_can_manage_team(
    target_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.teams t
            where t.id = target_team_id
              and public.iq_v3_can_manage_club(t.club_id)
        )
        or exists (
            select 1
            from public.team_seasons ts
            where ts.team_id = target_team_id
              and public.iq_v3_has_team_season_role(
                    ts.id,
                    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
              )
        );
$$;

create or replace function public.iq_v3_can_read_game(
    target_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.games g
        where g.id = target_game_id
          and g.team_season_id is not null
          and public.iq_v3_has_team_season_access(g.team_season_id)
    );
$$;

create or replace function public.iq_v3_can_edit_game(
    target_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.games g
        where g.id = target_game_id
          and g.team_season_id is not null
          and public.iq_v3_has_team_season_role(
              g.team_season_id,
              array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
          )
    );
$$;

create or replace function public.iq_v3_can_delete_game(
    target_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.games g
        where g.id = target_game_id
          and g.team_season_id is not null
          and public.iq_v3_has_team_season_role(
              g.team_season_id,
              array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
          )
    );
$$;

create or replace function public.iq_v3_can_read_player(
    target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.user_player_links upl
            where upl.user_id = auth.uid()
              and upl.player_id = target_player_id
              and upper(upl.status) = 'ACTIVE'
        )
        or exists (
            select 1
            from public.roster_memberships rm
            where rm.player_id = target_player_id
              and public.iq_v3_has_team_season_access(rm.team_season_id)
        );
$$;

create or replace function public.iq_v3_can_manage_player(
    target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.roster_memberships rm
            where rm.player_id = target_player_id
              and public.iq_v3_has_team_season_role(
                  rm.team_season_id,
                  array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
              )
        );
$$;

create or replace function public.iq_v3_can_read_private_player_data(
    target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.user_player_links upl
            where upl.user_id = auth.uid()
              and upl.player_id = target_player_id
              and upper(upl.status) = 'ACTIVE'
              and upper(upl.relation_type) = 'SELF'
        )
        or exists (
            select 1
            from public.roster_memberships rm
            where rm.player_id = target_player_id
              and public.iq_v3_has_team_season_role(
                  rm.team_season_id,
                  array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
              )
        );
$$;

create or replace function public.iq_v3_can_view_user_profile(
    target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        target_user_id = auth.uid()
        or public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.team_season_memberships manager
            join public.team_season_memberships target
              on target.team_season_id = manager.team_season_id
            where manager.user_id = auth.uid()
              and target.user_id = target_user_id
              and upper(manager.status) = 'ACTIVE'
              and upper(target.status) = 'ACTIVE'
              and upper(manager.function_role) in (
                  'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'
              )
        );
$$;

revoke all on function public.iq_v3_is_superadmin() from public;
revoke all on function public.iq_v3_global_role() from public;
revoke all on function public.iq_v3_has_team_season_access(uuid) from public;
revoke all on function public.iq_v3_has_team_season_role(uuid,text[]) from public;
revoke all on function public.iq_v3_can_manage_club(uuid) from public;
revoke all on function public.iq_v3_can_manage_team(uuid) from public;
revoke all on function public.iq_v3_can_read_game(uuid) from public;
revoke all on function public.iq_v3_can_edit_game(uuid) from public;
revoke all on function public.iq_v3_can_delete_game(uuid) from public;
revoke all on function public.iq_v3_can_read_player(uuid) from public;
revoke all on function public.iq_v3_can_manage_player(uuid) from public;
revoke all on function public.iq_v3_can_read_private_player_data(uuid) from public;
revoke all on function public.iq_v3_can_view_user_profile(uuid) from public;

grant execute on function public.iq_v3_is_superadmin() to authenticated;
grant execute on function public.iq_v3_global_role() to authenticated;
grant execute on function public.iq_v3_has_team_season_access(uuid) to authenticated;
grant execute on function public.iq_v3_has_team_season_role(uuid,text[]) to authenticated;
grant execute on function public.iq_v3_can_manage_club(uuid) to authenticated;
grant execute on function public.iq_v3_can_manage_team(uuid) to authenticated;
grant execute on function public.iq_v3_can_read_game(uuid) to authenticated;
grant execute on function public.iq_v3_can_edit_game(uuid) to authenticated;
grant execute on function public.iq_v3_can_delete_game(uuid) to authenticated;
grant execute on function public.iq_v3_can_read_player(uuid) to authenticated;
grant execute on function public.iq_v3_can_manage_player(uuid) to authenticated;
grant execute on function public.iq_v3_can_read_private_player_data(uuid) to authenticated;
grant execute on function public.iq_v3_can_view_user_profile(uuid) to authenticated;

-- ============================================================================
-- 2. REMOVE KNOWN PERMISSIVE LEGACY POLICIES INSIDE THIS REHEARSAL TRANSACTION
-- ============================================================================

drop policy if exists "Permitir actualizacion solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir borrado solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir insercion solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir lectura a usuarios autenticados" on public.game_events;
drop policy if exists "Permitir todo a usuarios autenticados y anon en game_events" on public.game_events;
drop policy if exists "Permitir todo en game_events" on public.game_events;
drop policy if exists "Permitir todo a usuarios autenticados y anon en game_period_sco" on public.game_period_scores;
drop policy if exists "Permitir todo a usuarios autenticados y anon en games" on public.games;
drop policy if exists "Permitir todo a usuarios autenticados y anon en player_game_sta" on public.player_game_stats;
drop policy if exists "Permitir update publico player_game_stats" on public.player_game_stats;
drop policy if exists "Permitir update publico players" on public.players;
drop policy if exists "Escritura de traducciones" on public.translations;
drop policy if exists "Lectura pública de traducciones" on public.translations;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

alter table public.clubs enable row level security;
alter table public.teams enable row level security;
alter table public.season_catalog enable row level security;
alter table public.team_seasons enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roster_memberships enable row level security;
alter table public.team_season_memberships enable row level security;
alter table public.club_season_memberships enable row level security;
alter table public.user_player_links enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.player_game_stats enable row level security;
alter table public.team_game_stats enable row level security;
alter table public.game_events enable row level security;
alter table public.game_period_scores enable row level security;
alter table public.lineup_game_stats enable row level security;
alter table public.play_by_play_events enable row level security;
alter table public.player_goals enable row level security;
alter table public.player_notes enable row level security;
alter table public.reports enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.analytics_runs enable row level security;
alter table public.player_season_metrics enable row level security;
alter table public.team_season_metrics enable row level security;
alter table public.lineup_season_metrics enable row level security;
alter table public.translations enable row level security;

-- Legacy/transition tables are locked down as well.
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.team_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.invitations enable row level security;

-- ============================================================================
-- 4. DIRECTORY / CATALOG POLICIES
-- ============================================================================

create policy "v3 clubs authenticated read"
on public.clubs for select
to authenticated
using (true);

create policy "v3 clubs managed update"
on public.clubs for update
to authenticated
using (public.iq_v3_can_manage_club(id))
with check (public.iq_v3_can_manage_club(id));

create policy "v3 clubs superadmin insert"
on public.clubs for insert
to authenticated
with check (public.iq_v3_is_superadmin());

create policy "v3 clubs superadmin delete"
on public.clubs for delete
to authenticated
using (public.iq_v3_is_superadmin());

create policy "v3 teams authenticated read"
on public.teams for select
to authenticated
using (true);

create policy "v3 teams managed insert"
on public.teams for insert
to authenticated
with check (
    public.iq_v3_is_superadmin()
    or public.iq_v3_can_manage_club(club_id)
);

create policy "v3 teams managed update"
on public.teams for update
to authenticated
using (public.iq_v3_can_manage_team(id))
with check (public.iq_v3_can_manage_club(club_id));

create policy "v3 teams managed delete"
on public.teams for delete
to authenticated
using (
    public.iq_v3_is_superadmin()
    or public.iq_v3_can_manage_team(id)
);

create policy "v3 season catalog authenticated read"
on public.season_catalog for select
to authenticated
using (true);

create policy "v3 season catalog superadmin write"
on public.season_catalog for all
to authenticated
using (public.iq_v3_is_superadmin())
with check (public.iq_v3_is_superadmin());

create policy "v3 team seasons authenticated read"
on public.team_seasons for select
to authenticated
using (true);

create policy "v3 team seasons managed insert"
on public.team_seasons for insert
to authenticated
with check (public.iq_v3_can_manage_team(team_id));

create policy "v3 team seasons managed update"
on public.team_seasons for update
to authenticated
using (public.iq_v3_can_manage_team(team_id))
with check (public.iq_v3_can_manage_team(team_id));

create policy "v3 team seasons managed delete"
on public.team_seasons for delete
to authenticated
using (public.iq_v3_can_manage_team(team_id));

-- ============================================================================
-- 5. USER / MEMBERSHIP POLICIES
-- ============================================================================

create policy "v3 user profiles scoped read"
on public.user_profiles for select
to authenticated
using (public.iq_v3_can_view_user_profile(id));

-- Security-sensitive user_profiles writes are intentionally NOT granted here.
-- Own-profile edits and role/access changes must go through dedicated RPC/Edge
-- functions with column-level validation.

create policy "v3 team memberships scoped read"
on public.team_season_memberships for select
to authenticated
using (
    user_id = auth.uid()
    or public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
    )
);

create policy "v3 club memberships own or superadmin read"
on public.club_season_memberships for select
to authenticated
using (
    user_id = auth.uid()
    or public.iq_v3_is_superadmin()
);

create policy "v3 user player links own or manager read"
on public.user_player_links for select
to authenticated
using (
    user_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
);

-- Membership and user-player-link writes are intentionally RPC-only.

-- ============================================================================
-- 6. ROSTER / PLAYER POLICIES
-- ============================================================================

create policy "v3 roster scoped read"
on public.roster_memberships for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 roster managed insert"
on public.roster_memberships for insert
to authenticated
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
    )
);

create policy "v3 roster managed update"
on public.roster_memberships for update
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
    )
);

create policy "v3 roster managed delete"
on public.roster_memberships for delete
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
    )
);

create policy "v3 players scoped read"
on public.players for select
to authenticated
using (public.iq_v3_can_read_player(id));

create policy "v3 players managed insert"
on public.players for insert
to authenticated
with check (public.iq_v3_is_superadmin());

create policy "v3 players managed update"
on public.players for update
to authenticated
using (public.iq_v3_can_manage_player(id))
with check (public.iq_v3_can_manage_player(id));

create policy "v3 players superadmin delete"
on public.players for delete
to authenticated
using (public.iq_v3_is_superadmin());

-- ============================================================================
-- 7. GAME / STATS / EVENTS POLICIES
-- ============================================================================

create policy "v3 games scoped read"
on public.games for select
to authenticated
using (
    team_season_id is not null
    and public.iq_v3_has_team_season_access(team_season_id)
);

create policy "v3 games scoped insert"
on public.games for insert
to authenticated
with check (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
    )
);

create policy "v3 games scoped update"
on public.games for update
to authenticated
using (public.iq_v3_can_edit_game(id))
with check (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
    )
);

create policy "v3 games restricted delete"
on public.games for delete
to authenticated
using (public.iq_v3_can_delete_game(id));

-- Game child tables: same scope as the parent game.
create policy "v3 player game stats read"
on public.player_game_stats for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 player game stats insert"
on public.player_game_stats for insert
to authenticated
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 player game stats update"
on public.player_game_stats for update
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 player game stats delete"
on public.player_game_stats for delete
to authenticated
using (public.iq_v3_can_edit_game(game_id));

create policy "v3 team game stats read"
on public.team_game_stats for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 team game stats insert"
on public.team_game_stats for insert
to authenticated
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 team game stats update"
on public.team_game_stats for update
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 team game stats delete"
on public.team_game_stats for delete
to authenticated
using (public.iq_v3_can_edit_game(game_id));

create policy "v3 game events read"
on public.game_events for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 game events insert"
on public.game_events for insert
to authenticated
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 game events update"
on public.game_events for update
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 game events delete"
on public.game_events for delete
to authenticated
using (public.iq_v3_can_edit_game(game_id));

create policy "v3 period scores read"
on public.game_period_scores for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 period scores write"
on public.game_period_scores for all
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 lineup stats read"
on public.lineup_game_stats for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 lineup stats write"
on public.lineup_game_stats for all
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 play by play read"
on public.play_by_play_events for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 play by play write"
on public.play_by_play_events for all
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

-- ============================================================================
-- 8. PLAYER NOTES / GOALS / REPORTS
-- ============================================================================

create policy "v3 player goals scoped read"
on public.player_goals for select
to authenticated
using (public.iq_v3_can_read_player(player_id));

create policy "v3 player goals managed write"
on public.player_goals for all
to authenticated
using (public.iq_v3_can_manage_player(player_id))
with check (public.iq_v3_can_manage_player(player_id));

create policy "v3 player notes scoped read"
on public.player_notes for select
to authenticated
using (
    public.iq_v3_can_read_player(player_id)
    and (
        not is_private
        or author_id = auth.uid()
        or public.iq_v3_can_read_private_player_data(player_id)
    )
);

create policy "v3 player notes staff insert"
on public.player_notes for insert
to authenticated
with check (
    author_id = auth.uid()
    and public.iq_v3_can_read_private_player_data(player_id)
);

create policy "v3 player notes author update"
on public.player_notes for update
to authenticated
using (
    author_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
)
with check (
    author_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
);

create policy "v3 player notes author delete"
on public.player_notes for delete
to authenticated
using (
    author_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
);

create policy "v3 reports scoped read"
on public.reports for select
to authenticated
using (
    (team_season_id is not null and public.iq_v3_has_team_season_access(team_season_id))
    or (game_id is not null and public.iq_v3_can_read_game(game_id))
    or (player_id is not null and public.iq_v3_can_read_player(player_id))
);

create policy "v3 reports staff write"
on public.reports for all
to authenticated
using (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
)
with check (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
);

-- ============================================================================
-- 9. ANALYTICS POLICIES
-- ============================================================================

create policy "v3 analytics runs scoped read"
on public.analytics_runs for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 analytics runs staff write"
on public.analytics_runs for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
);

create policy "v3 player season metrics read"
on public.player_season_metrics for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 player season metrics staff write"
on public.player_season_metrics for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
);

create policy "v3 team season metrics read"
on public.team_season_metrics for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 team season metrics staff write"
on public.team_season_metrics for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
);

create policy "v3 lineup season metrics read"
on public.lineup_season_metrics for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 lineup season metrics staff write"
on public.lineup_season_metrics for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
);

-- ============================================================================
-- 10. ACCESS REQUESTS
-- ============================================================================

create policy "v3 team requests own read"
on public.team_join_requests for select
to authenticated
using (
    user_id = auth.uid()
    or (
        team_season_id is not null
        and public.iq_v3_has_team_season_role(
            team_season_id,
            array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
        )
    )
);

create policy "v3 team requests own insert"
on public.team_join_requests for insert
to authenticated
with check (
    user_id = auth.uid()
    and team_season_id is not null
);

-- UPDATE/DELETE intentionally omitted: request review is RPC-only.

-- ============================================================================
-- 11. TRANSLATIONS
-- ============================================================================

create policy "v3 translations public read"
on public.translations for select
to anon, authenticated
using (true);

create policy "v3 translations superadmin insert"
on public.translations for insert
to authenticated
with check (public.iq_v3_is_superadmin());

create policy "v3 translations superadmin update"
on public.translations for update
to authenticated
using (public.iq_v3_is_superadmin())
with check (public.iq_v3_is_superadmin());

create policy "v3 translations superadmin delete"
on public.translations for delete
to authenticated
using (public.iq_v3_is_superadmin());

-- ============================================================================
-- 12. LEGACY TABLE TRANSITION POLICIES
-- ============================================================================

create policy "v3 legacy seasons scoped read"
on public.seasons for select
to authenticated
using (
    public.iq_v3_is_superadmin()
    or exists (
        select 1
        from public.team_seasons ts
        where ts.legacy_season_id = seasons.id
          and public.iq_v3_has_team_season_access(ts.id)
    )
);

create policy "v3 legacy team members own read"
on public.team_members for select
to authenticated
using (
    public.iq_v3_is_superadmin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- profiles/join_requests/invitations intentionally receive NO access policies.
-- With RLS enabled they become inaccessible to client roles and can be retired
-- only after final migration validation.

-- ============================================================================
-- 13. GRANTS
-- ============================================================================

-- Remove anonymous writes from operational data.
revoke insert, update, delete on
    public.clubs,
    public.teams,
    public.games,
    public.players,
    public.player_game_stats,
    public.team_game_stats,
    public.game_events,
    public.game_period_scores,
    public.lineup_game_stats,
    public.play_by_play_events,
    public.player_goals,
    public.player_notes,
    public.reports,
    public.team_join_requests,
    public.translations
from anon;

-- Runtime authenticated access is still row-filtered by RLS.
grant select on
    public.clubs,
    public.teams,
    public.season_catalog,
    public.team_seasons,
    public.user_profiles,
    public.roster_memberships,
    public.team_season_memberships,
    public.club_season_memberships,
    public.user_player_links,
    public.games,
    public.players,
    public.player_game_stats,
    public.team_game_stats,
    public.game_events,
    public.game_period_scores,
    public.lineup_game_stats,
    public.play_by_play_events,
    public.player_goals,
    public.player_notes,
    public.reports,
    public.team_join_requests,
    public.analytics_runs,
    public.player_season_metrics,
    public.team_season_metrics,
    public.lineup_season_metrics,
    public.translations,
    public.seasons,
    public.team_members
to authenticated;

grant insert, update, delete on
    public.clubs,
    public.teams,
    public.season_catalog,
    public.team_seasons,
    public.roster_memberships,
    public.games,
    public.players,
    public.player_game_stats,
    public.team_game_stats,
    public.game_events,
    public.game_period_scores,
    public.lineup_game_stats,
    public.play_by_play_events,
    public.player_goals,
    public.player_notes,
    public.reports,
    public.team_join_requests,
    public.analytics_runs,
    public.player_season_metrics,
    public.team_season_metrics,
    public.lineup_season_metrics,
    public.translations
to authenticated;

grant select on public.translations to anon;

-- Security-sensitive tables remain read-only to authenticated clients.
revoke insert, update, delete on
    public.user_profiles,
    public.team_season_memberships,
    public.club_season_memberships,
    public.user_player_links
from authenticated;

-- ============================================================================
-- 14. POLICY INVENTORY FOR REVIEW
-- ============================================================================

select
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ============================================================================
-- 15. EXPLICIT ROLLBACK
-- ============================================================================

rollback;

-- Production deployment will only replace ROLLBACK with COMMIT after:
--   * backup;
--   * data-model backfill;
--   * user/team-season membership backfill;
--   * role-by-role RLS test matrix;
--   * application v3 compatibility;
--   * explicit approval.
