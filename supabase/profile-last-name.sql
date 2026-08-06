-- Last name on profiles (helps leaders tell partners apart).
-- Safe to run after the main First Seeds schema.

alter table public.profiles
  add column if not exists last_name text not null default '';

-- Capture last_name from signup metadata when possible.
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

-- Refresh team_graph payload so leaders see last names on the live tree.
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

grant execute on function public.profile_subtree(uuid, integer) to authenticated;

-- Verify
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'last_name';
