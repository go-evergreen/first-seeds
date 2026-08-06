-- Prefer team-graph-depth-6.sql or profile-last-name.sql (includes last_name).
-- Safe to re-run in Supabase SQL Editor.

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
