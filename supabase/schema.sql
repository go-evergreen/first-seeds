-- First Seeds Bridge Hub — Supabase schema
-- Run this in the Supabase SQL editor for your project.
-- Safe to re-run: uses IF NOT EXISTS / drop policies carefully.

-- ── profiles ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  last_name text not null default '',
  hub_mode text not null default '' check (hub_mode in ('', 'starter', 'full')),
  tour_done boolean not null default false,
  invite_code text unique,
  sponsor_id uuid references public.profiles (id) on delete set null,
  invited_by_id uuid references public.profiles (id) on delete set null,
  is_org_admin boolean not null default false,
  is_super_admin boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_sponsor_idx on public.profiles (sponsor_id);
create index if not exists profiles_invite_code_idx on public.profiles (invite_code);
create index if not exists profiles_invited_by_idx on public.profiles (invited_by_id);
create unique index if not exists profiles_email_unique_ci
  on public.profiles (lower(trim(email)))
  where email is not null and length(trim(email)) > 0;

-- ── runway progress (one row per partner) ─────────────────
create table if not exists public.runway_progress (
  partner_id uuid primary key references public.profiles (id) on delete cascade,
  active text not null default 'welcome',
  data jsonb not null default '{}'::jsonb,
  done jsonb not null default '{}'::jsonb,
  calendar jsonb not null default '{}'::jsonb,
  cheers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── how i grow (partner support preferences) ─────────────
create table if not exists public.support_preferences (
  partner_id uuid primary key references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ── leader notes (optional message shown on a section) ────
create table if not exists public.leader_notes (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  section_id text not null default 'welcome',
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (sponsor_id, partner_id, section_id)
);

-- ── nudge / cheer events (async belonging) ────────────────
create table if not exists public.team_events (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('cheer', 'nudge', 'notify')),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists team_events_partner_idx on public.team_events (partner_id, created_at desc);

-- ── auto profile on signup ────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  code text;
begin
  code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.profiles (id, email, display_name, last_name, invite_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'friend'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    code
  )
  on conflict (id) do nothing;
  insert into public.runway_progress (partner_id)
  values (new.id)
  on conflict (partner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at helper ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists runway_updated on public.runway_progress;
create trigger runway_updated before update on public.runway_progress
  for each row execute function public.set_updated_at();

drop trigger if exists support_preferences_updated on public.support_preferences;
create trigger support_preferences_updated before update on public.support_preferences
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.runway_progress enable row level security;
alter table public.support_preferences enable row level security;
alter table public.leader_notes enable row level security;
alter table public.team_events enable row level security;

-- profiles: read self + direct downline; update self
drop policy if exists "profiles_select_own_or_downline" on public.profiles;
create policy "profiles_select_own_or_downline" on public.profiles
  for select using (
    id = auth.uid()
    or sponsor_id = auth.uid()
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- runway: own row; sponsors can read downline progress
drop policy if exists "runway_select_own_or_sponsor" on public.runway_progress;
create policy "runway_select_own_or_sponsor" on public.runway_progress
  for select using (
    partner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = runway_progress.partner_id and p.sponsor_id = auth.uid()
    )
  );

drop policy if exists "runway_upsert_own" on public.runway_progress;
create policy "runway_upsert_own" on public.runway_progress
  for insert with check (partner_id = auth.uid());

drop policy if exists "runway_update_own" on public.runway_progress;
create policy "runway_update_own" on public.runway_progress
  for update using (partner_id = auth.uid());

-- How I Grow: partner owns the answers; current direct sponsor can read them
drop policy if exists "support_preferences_select_own_or_sponsor" on public.support_preferences;
create policy "support_preferences_select_own_or_sponsor" on public.support_preferences
  for select using (
    partner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = support_preferences.partner_id
        and p.sponsor_id = auth.uid()
    )
  );

drop policy if exists "support_preferences_insert_own" on public.support_preferences;
create policy "support_preferences_insert_own" on public.support_preferences
  for insert with check (partner_id = auth.uid());

drop policy if exists "support_preferences_update_own" on public.support_preferences;
create policy "support_preferences_update_own" on public.support_preferences
  for update using (partner_id = auth.uid())
  with check (partner_id = auth.uid());

-- leader notes: sponsor writes; partner + sponsor read
drop policy if exists "notes_select" on public.leader_notes;
create policy "notes_select" on public.leader_notes
  for select using (sponsor_id = auth.uid() or partner_id = auth.uid());

drop policy if exists "notes_write_sponsor" on public.leader_notes;
create policy "notes_write_sponsor" on public.leader_notes
  for all using (sponsor_id = auth.uid()) with check (sponsor_id = auth.uid());

-- team events
drop policy if exists "events_select" on public.team_events;
create policy "events_select" on public.team_events
  for select using (sponsor_id = auth.uid() or partner_id = auth.uid());

drop policy if exists "events_insert_sponsor" on public.team_events;
create policy "events_insert_sponsor" on public.team_events
  for insert with check (sponsor_id = auth.uid());

-- partners can ping their sponsor (notify)
drop policy if exists "events_insert_partner_notify" on public.team_events;
create policy "events_insert_partner_notify" on public.team_events
  for insert with check (
    partner_id = auth.uid()
    and kind = 'notify'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.sponsor_id = team_events.sponsor_id
    )
  );

drop policy if exists "events_update_partner" on public.team_events;
create policy "events_update_partner" on public.team_events
  for update using (partner_id = auth.uid() or sponsor_id = auth.uid());

-- ── helper: attach sponsor by invite code (called from client after login) ─
create or replace function public.attach_sponsor(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  sponsor uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select id into sponsor from public.profiles
  where lower(invite_code) = lower(trim(code)) and id <> me
  limit 1;
  if sponsor is null then
    return null;
  end if;
  perform set_config('first_seeds.bypass_link_guard', '1', true);
  update public.profiles
  set
    sponsor_id = coalesce(sponsor_id, sponsor),
    invited_by_id = coalesce(invited_by_id, sponsor)
  where id = me
    and (sponsor_id is null or invited_by_id is null);
  return sponsor;
end;
$$;

grant execute on function public.attach_sponsor(text) to authenticated;

-- Guard sponsor / invited_by / admin flags (see team-reparent-admin.sql for full deploy patch)
create or replace function public.protect_profile_links()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.invited_by_id is not null then
      new.invited_by_id := old.invited_by_id;
    end if;
    if new.sponsor_id is distinct from old.sponsor_id
       and current_setting('first_seeds.bypass_link_guard', true) is distinct from '1' then
      raise exception 'sponsor_id can only change via attach_sponsor or reparent_partner';
    end if;
    if (new.is_org_admin is distinct from old.is_org_admin
        or new.is_super_admin is distinct from old.is_super_admin)
       and current_setting('first_seeds.bypass_admin_guard', true) is distinct from '1' then
      raise exception 'Admin flags can only change via set_org_admin (or SQL bootstrap)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_links on public.profiles;
create trigger profiles_protect_links
  before update on public.profiles
  for each row execute function public.protect_profile_links();

create or replace function public.my_support_context()
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  me uuid := auth.uid();
  row public.profiles%rowtype;
  inviter public.profiles%rowtype;
  sponsor public.profiles%rowtype;
begin
  if me is null then
    return '{}'::jsonb;
  end if;
  select * into row from public.profiles where id = me;
  if not found then
    return '{}'::jsonb;
  end if;
  if row.invited_by_id is not null then
    select * into inviter from public.profiles where id = row.invited_by_id;
  end if;
  if row.sponsor_id is not null then
    select * into sponsor from public.profiles where id = row.sponsor_id;
  end if;
  return jsonb_build_object(
    'invited_by_id', row.invited_by_id,
    'invited_by_name', case
      when inviter.id is null then null
      when coalesce(trim(inviter.last_name), '') = '' then coalesce(nullif(trim(inviter.display_name), ''), inviter.email)
      when lower(trim(coalesce(inviter.display_name, ''))) like ('%' || lower(trim(inviter.last_name)))
        then coalesce(nullif(trim(inviter.display_name), ''), inviter.email)
      else trim(both from concat_ws(' ', nullif(trim(inviter.display_name), ''), trim(inviter.last_name)))
    end,
    'sponsor_id', row.sponsor_id,
    'sponsor_name', case
      when sponsor.id is null then null
      when coalesce(trim(sponsor.last_name), '') = '' then coalesce(nullif(trim(sponsor.display_name), ''), sponsor.email)
      when lower(trim(coalesce(sponsor.display_name, ''))) like ('%' || lower(trim(sponsor.last_name)))
        then coalesce(nullif(trim(sponsor.display_name), ''), sponsor.email)
      else trim(both from concat_ws(' ', nullif(trim(sponsor.display_name), ''), trim(sponsor.last_name)))
    end
  );
end;
$$;

grant execute on function public.my_support_context() to authenticated;

create or replace function public.admin_list_profiles()
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  me uuid := auth.uid();
  ok boolean;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(is_org_admin, false) into ok from public.profiles where id = me;
  if not ok then
    raise exception 'Org admin only';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'email', p.email,
          'sponsor_id', p.sponsor_id,
          'invited_by_id', p.invited_by_id,
          'is_org_admin', p.is_org_admin,
          'is_super_admin', p.is_super_admin,
          'hub_mode', p.hub_mode,
          'created_at', p.created_at
        )
        order by lower(coalesce(p.display_name, p.email, ''))
      )
      from public.profiles p
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.admin_list_profiles() to authenticated;

create or replace function public.reparent_partner(partner uuid, new_sponsor uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  ok boolean;
  walk uuid;
  hops int := 0;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(is_org_admin, false) into ok from public.profiles where id = me;
  if not ok then
    raise exception 'Org admin only';
  end if;
  if partner is null or new_sponsor is null then
    raise exception 'Partner and new sponsor are required';
  end if;
  if partner = new_sponsor then
    raise exception 'Someone cannot be under themselves';
  end if;
  if not exists (select 1 from public.profiles where id = partner) then
    raise exception 'Partner not found';
  end if;
  if not exists (select 1 from public.profiles where id = new_sponsor) then
    raise exception 'New sponsor not found';
  end if;
  walk := new_sponsor;
  while walk is not null and hops < 64 loop
    if walk = partner then
      raise exception 'That move would create a loop in the tree';
    end if;
    select sponsor_id into walk from public.profiles where id = walk;
    hops := hops + 1;
  end loop;
  perform set_config('first_seeds.bypass_link_guard', '1', true);
  update public.profiles
  set sponsor_id = new_sponsor
  where id = partner;
  return jsonb_build_object(
    'partner_id', partner,
    'sponsor_id', new_sponsor
  );
end;
$$;

grant execute on function public.reparent_partner(uuid, uuid) to authenticated;

create or replace function public.set_org_admin(partner uuid, enabled boolean)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  am_super boolean;
  target_super boolean;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  select coalesce(is_super_admin, false) into am_super from public.profiles where id = me;
  if not am_super then
    raise exception 'Super admin only';
  end if;
  if partner is null then
    raise exception 'Partner required';
  end if;
  if partner = me and enabled is false then
    raise exception 'You cannot remove your own admin access here';
  end if;
  select coalesce(is_super_admin, false) into target_super from public.profiles where id = partner;
  if not found then
    raise exception 'Partner not found';
  end if;
  if target_super then
    raise exception 'Cannot change org-admin flag on a super admin';
  end if;
  perform set_config('first_seeds.bypass_admin_guard', '1', true);
  update public.profiles
  set is_org_admin = coalesce(enabled, false)
  where id = partner;
  return jsonb_build_object(
    'partner_id', partner,
    'is_org_admin', coalesce(enabled, false)
  );
end;
$$;

grant execute on function public.set_org_admin(uuid, boolean) to authenticated;

-- ── team graph: up to N levels under you (structure / names only) ─
create or replace function public.profile_subtree(parent_id uuid, remaining integer)
returns jsonb
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'last_name', p.last_name,
        'email', p.email,
        'hub_mode', p.hub_mode,
        'last_active_at', p.last_active_at,
        'created_at', p.created_at,
        'children', case
          when remaining > 1 then public.profile_subtree(p.id, remaining - 1)
          else '[]'::jsonb
        end
      )
      order by p.created_at asc nulls last
    ),
    '[]'::jsonb
  )
  from public.profiles p
  where p.sponsor_id = parent_id;
$$;

create or replace function public.team_graph(max_depth integer default 6)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  me uuid := auth.uid();
  depth integer := greatest(1, least(coalesce(max_depth, 6), 6));
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  return public.profile_subtree(me, depth);
end;
$$;

grant execute on function public.profile_subtree(uuid, integer) to authenticated;
grant execute on function public.team_graph(integer) to authenticated;

-- ── personal lead pages (run supabase/leads.sql next) ─────
-- Adds lead_slug, leads table, get_lead_page / submit_lead / claim_lead_slug RPCs.
