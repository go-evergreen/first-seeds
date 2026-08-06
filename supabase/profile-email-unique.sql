-- Unique emails on profiles (case-insensitive).
-- Safe to re-run. Fails if duplicates still exist — clean those first.

-- Find any remaining duplicates before creating the index:
-- select lower(trim(email)) as e, count(*), array_agg(id::text)
-- from public.profiles
-- where email is not null and length(trim(email)) > 0
-- group by 1 having count(*) > 1;

create unique index if not exists profiles_email_unique_ci
  on public.profiles (lower(trim(email)))
  where email is not null and length(trim(email)) > 0;
