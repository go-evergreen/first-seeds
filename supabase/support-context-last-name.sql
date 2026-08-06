-- Include last names in How I Grow leader intro labels.
-- Safe to re-run.

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
