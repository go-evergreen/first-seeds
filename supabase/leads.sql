-- First Seeds — personal lead pages
-- Run AFTER supabase/schema.sql in the Supabase SQL editor.
-- Safe to re-run.

-- ── slug + optional page intro on each partner ────────────
alter table public.profiles
  add column if not exists lead_slug text,
  add column if not exists lead_blurb text not null default '';

create unique index if not exists profiles_lead_slug_idx
  on public.profiles (lower(lead_slug))
  where lead_slug is not null and lead_slug <> '';

-- ── leads inbox (one row per submission) ──────────────────
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  interest text not null check (interest in ('products', 'business', 'both')),
  status text not null default 'new' check (status in ('new', 'reached', 'done', 'archived')),
  source_slug text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contact_chk check (
    length(trim(email)) > 0 or length(trim(phone)) > 0
  )
);

create index if not exists leads_partner_created_idx
  on public.leads (partner_id, created_at desc);

drop trigger if exists leads_updated on public.leads;
create trigger leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- Partners only see / update their own leads. No direct public insert.
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
  for select using (partner_id = auth.uid());

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads
  for update using (partner_id = auth.uid());

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads
  for delete using (partner_id = auth.uid());

-- ── public page lookup (anon OK — returns only safe fields) ─
create or replace function public.get_lead_page(p_slug text)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  slug text := lower(trim(coalesce(p_slug, '')));
  row public.profiles%rowtype;
begin
  if slug = '' or length(slug) > 40 then
    return null;
  end if;
  select * into row from public.profiles
  where lead_slug is not null and lower(lead_slug) = slug
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'slug', row.lead_slug,
    'display_name', row.display_name,
    'blurb', coalesce(nullif(trim(row.lead_blurb), ''), '')
  );
end;
$$;

grant execute on function public.get_lead_page(text) to anon, authenticated;

-- ── public submit (anon OK — ownership resolved server-side) ─
create or replace function public.submit_lead(
  p_slug text,
  p_name text,
  p_email text,
  p_phone text,
  p_interest text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  slug text := lower(trim(coalesce(p_slug, '')));
  owner uuid;
  nm text := trim(coalesce(p_name, ''));
  em text := lower(trim(coalesce(p_email, '')));
  ph text := trim(coalesce(p_phone, ''));
  interest text := lower(trim(coalesce(p_interest, '')));
  new_id uuid;
begin
  if slug = '' or length(slug) > 40 then
    raise exception 'Page not found';
  end if;
  if length(nm) < 2 or length(nm) > 80 then
    raise exception 'Please enter your name';
  end if;
  if interest not in ('products', 'business', 'both') then
    raise exception 'Pick what you are interested in';
  end if;
  if length(em) = 0 and length(ph) = 0 then
    raise exception 'Add an email or a phone number';
  end if;
  if length(em) > 0 and (position('@' in em) < 2 or length(em) > 120) then
    raise exception 'That email does not look right';
  end if;
  if length(ph) > 40 then
    raise exception 'That phone number is too long';
  end if;

  select id into owner from public.profiles
  where lead_slug is not null and lower(lead_slug) = slug
  limit 1;
  if owner is null then
    raise exception 'Page not found';
  end if;

  insert into public.leads (partner_id, name, email, phone, interest, source_slug, status)
  values (owner, nm, em, ph, interest, slug, 'new')
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.submit_lead(text, text, text, text, text) to anon, authenticated;

-- ── claim / update own slug (authenticated) ───────────────
create or replace function public.claim_lead_slug(desired text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  base text;
  candidate text;
  n integer := 2;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  base := lower(trim(coalesce(desired, '')));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if length(base) < 2 then
    base := 'friend';
  end if;
  if length(base) > 30 then
    base := substr(base, 1, 30);
    base := trim(both '-' from base);
  end if;

  candidate := base;
  while exists (
    select 1 from public.profiles
    where lead_slug is not null
      and lower(lead_slug) = candidate
      and id <> me
  ) loop
    candidate := base || '-' || n::text;
    n := n + 1;
    if n > 99 then
      candidate := base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
      exit;
    end if;
  end loop;

  update public.profiles
  set lead_slug = candidate
  where id = me;

  return candidate;
end;
$$;

grant execute on function public.claim_lead_slug(text) to authenticated;
