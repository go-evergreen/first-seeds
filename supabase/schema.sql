-- First Seeds Bridge Hub — Supabase schema
-- Run this in the Supabase SQL editor for your project.
-- Safe to re-run: uses IF NOT EXISTS / drop policies carefully.

-- ── profiles ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  hub_mode text not null default '' check (hub_mode in ('', 'starter', 'full')),
  tour_done boolean not null default false,
  invite_code text unique,
  sponsor_id uuid references public.profiles (id) on delete set null,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_sponsor_idx on public.profiles (sponsor_id);
create index if not exists profiles_invite_code_idx on public.profiles (invite_code);

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
  insert into public.profiles (id, email, display_name, invite_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'friend'), '@', 1)),
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

-- ── RLS ───────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.runway_progress enable row level security;
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
  update public.profiles
  set sponsor_id = coalesce(sponsor_id, sponsor)
  where id = me and sponsor_id is null;
  return sponsor;
end;
$$;

grant execute on function public.attach_sponsor(text) to authenticated;

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
        'email', p.email,
        'hub_mode', p.hub_mode,
        'last_active_at', p.last_active_at,
        'children', case
          when remaining > 1 then public.profile_subtree(p.id, remaining - 1)
          else '[]'::jsonb
        end
      )
      order by p.last_active_at desc nulls last
    ),
    '[]'::jsonb
  )
  from public.profiles p
  where p.sponsor_id = parent_id;
$$;

create or replace function public.team_graph(max_depth integer default 4)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  me uuid := auth.uid();
  depth integer := greatest(1, least(coalesce(max_depth, 4), 6));
begin
  if me is null then
    return '[]'::jsonb;
  end if;
  return public.profile_subtree(me, depth);
end;
$$;

grant execute on function public.profile_subtree(uuid, integer) to authenticated;
grant execute on function public.team_graph(integer) to authenticated;
