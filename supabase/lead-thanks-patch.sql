-- Run once in Supabase SQL Editor (after prior leads.sql).
-- Adds customizable success message for personal lead pages.

alter table public.profiles
  add column if not exists lead_thanks text not null default '';

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
    'blurb', coalesce(nullif(trim(row.lead_blurb), ''), ''),
    'thanks', coalesce(nullif(trim(row.lead_thanks), ''), '')
  );
end;
$$;

grant execute on function public.get_lead_page(text) to anon, authenticated;
