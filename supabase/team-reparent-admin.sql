-- Org-admin rearrange + frozen invited_by + super-admin grants.
-- Run once in Supabase → SQL Editor → Run.
-- Then bootstrap YOUR account (edit email). Must bypass the guard in the same transaction:
--   select set_config('first_seeds.bypass_admin_guard', '1', true);
--   update public.profiles
--   set is_org_admin = true, is_super_admin = true
--   where lower(email) = lower('you@example.com');

-- ── columns ───────────────────────────────────────────────
alter table public.profiles
  add column if not exists invited_by_id uuid references public.profiles (id) on delete set null;

alter table public.profiles
  add column if not exists is_org_admin boolean not null default false;

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

create index if not exists profiles_invited_by_idx on public.profiles (invited_by_id);

-- Backfill: original inviter = current sponsor for existing rows
update public.profiles
set invited_by_id = sponsor_id
where invited_by_id is null and sponsor_id is not null;

-- Super admin is always an org admin
update public.profiles
set is_org_admin = true
where is_super_admin = true and is_org_admin = false;

-- ── guard: sponsor / invited_by / admin flags only via RPCs ─
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

-- ── attach: set sponsor + invited_by once ─────────────────
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

-- ── support line for the signed-in partner ────────────────
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
    'invited_by_name', coalesce(inviter.display_name, inviter.email, null),
    'sponsor_id', row.sponsor_id,
    'sponsor_name', coalesce(sponsor.display_name, sponsor.email, null)
  );
end;
$$;

grant execute on function public.my_support_context() to authenticated;

-- ── org admin: list people for rearrange picker ───────────
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

-- ── reparent (org admin): mentoring follows new sponsor ───
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

  /* Cycle check: walking up from new_sponsor must never hit partner */
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

-- ── super admin only: grant / revoke org admin ────────────
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
