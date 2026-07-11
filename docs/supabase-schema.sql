-- RoleGuage account profile storage.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_text text,
  resume_file_name text,
  candidate_profile jsonb not null default '{}'::jsonb,
  cover_letter_instructions text,
  cover_letter_examples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.user_profiles;
drop policy if exists "Users can insert their own profile" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;
drop policy if exists "Users can delete their own profile" on public.user_profiles;

create policy "Users can read their own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own profile"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own profile"
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own profile"
on public.user_profiles
for delete
to authenticated
using (auth.uid() = user_id);
