-- Clean up duplicate Jessica accounts + harden email uniqueness.
-- Run in Supabase → SQL Editor.
--
-- Keep:  58b83153-76f1-4c0f-a357-669cd4fb9919  (created second)
-- Delete: 530dcf50-6d68-4a91-b728-bb8a40471208  (created first)

-- ── 0) Sanity check both auth + profile rows ──────────────
select
  u.id,
  u.email as auth_email,
  u.created_at as auth_created,
  u.email_confirmed_at,
  u.last_sign_in_at,
  p.display_name,
  p.sponsor_id,
  p.invited_by_id
from auth.users u
left join public.profiles p on p.id = u.id
where u.id in (
  '530dcf50-6d68-4a91-b728-bb8a40471208',
  '58b83153-76f1-4c0f-a357-669cd4fb9919'
)
order by u.created_at;

-- Anyone sitting under the OLD Jessica? (reparent before delete if any)
select id, display_name, email, sponsor_id
from public.profiles
where sponsor_id = '530dcf50-6d68-4a91-b728-bb8a40471208'
   or invited_by_id = '530dcf50-6d68-4a91-b728-bb8a40471208';

-- Progress on each (keep the one she’s actually using)
select
  partner_id,
  updated_at,
  done,
  jsonb_pretty(data) as data_preview
from public.runway_progress
where partner_id in (
  '530dcf50-6d68-4a91-b728-bb8a40471208',
  '58b83153-76f1-4c0f-a357-669cd4fb9919'
);

-- ── 1) If anyone is under the old Jessica, move them to Brittany ─
-- (or to the kept Jessica — edit the new_sponsor id if needed)
do $$
declare
  old_jessica uuid := '530dcf50-6d68-4a91-b728-bb8a40471208';
  keep_jessica uuid := '58b83153-76f1-4c0f-a357-669cd4fb9919';
  brittany uuid;
begin
  select sponsor_id into brittany from public.profiles where id = keep_jessica;
  if brittany is null then
    select sponsor_id into brittany from public.profiles where id = old_jessica;
  end if;

  perform set_config('first_seeds.bypass_link_guard', '1', true);

  if brittany is not null then
    update public.profiles
    set sponsor_id = brittany
    where sponsor_id = old_jessica;

    update public.profiles
    set invited_by_id = coalesce(invited_by_id, brittany)
    where invited_by_id = old_jessica;
  end if;
end $$;

-- ── 2) Delete the older auth user (cascades profile + progress) ─
delete from auth.users
where id = '530dcf50-6d68-4a91-b728-bb8a40471208';

-- Confirm only one Jessica remains under Brittany
select display_name, last_name, email, id, created_at
from public.profiles
where lower(email) = lower('jtyler0910@gmail.com');

-- ── 3) Prevent duplicate profile emails going forward ─────
-- Auth already unique-enforces email on auth.users in most projects;
-- this catches profile-level duplicates / drift.
create unique index if not exists profiles_email_unique_ci
  on public.profiles (lower(trim(email)))
  where email is not null and length(trim(email)) > 0;
