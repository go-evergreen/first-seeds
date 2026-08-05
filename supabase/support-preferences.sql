-- How I Grow: private partner support preferences.
-- Safe to run after the main First Seeds schema.

create table if not exists public.support_preferences (
  partner_id uuid primary key references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists support_preferences_updated on public.support_preferences;
create trigger support_preferences_updated
  before update on public.support_preferences
  for each row execute function public.set_updated_at();

alter table public.support_preferences enable row level security;

drop policy if exists "support_preferences_select_own_or_sponsor" on public.support_preferences;
create policy "support_preferences_select_own_or_sponsor"
  on public.support_preferences
  for select using (
    partner_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = support_preferences.partner_id
        and p.sponsor_id = auth.uid()
    )
  );

drop policy if exists "support_preferences_insert_own" on public.support_preferences;
create policy "support_preferences_insert_own"
  on public.support_preferences
  for insert with check (partner_id = auth.uid());

drop policy if exists "support_preferences_update_own" on public.support_preferences;
create policy "support_preferences_update_own"
  on public.support_preferences
  for update using (partner_id = auth.uid())
  with check (partner_id = auth.uid());

-- Verify: expects rls_enabled = true and exactly 3 policies.
select
  (select relrowsecurity from pg_class where oid = 'public.support_preferences'::regclass) as rls_enabled,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'support_preferences') as policy_count;
