-- StudyFlow database schema for Supabase PostgreSQL
-- Run this entire file in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

-- Public profile for each authenticated account.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(100) not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

-- A user can own many tasks; every task belongs to exactly one user.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title varchar(120) not null check (char_length(trim(title)) > 0),
  description varchar(1000) not null default '',
  due_date date not null,
  priority varchar(10) not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_index on public.tasks(user_id);
create index if not exists tasks_user_due_date_index on public.tasks(user_id, due_date);

-- Create a public profile immediately after Supabase Auth creates an account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also create profiles if Auth users existed before this script was run.
insert into public.users (id, full_name, email)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  coalesce(email, '')
from auth.users
on conflict (id) do nothing;

-- Keep updated_at correct without relying on the mobile application.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- Row Level Security prevents one student from reading another student's data.
alter table public.users enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Users can view their own profile" on public.users;
create policy "Users can view their own profile"
  on public.users for select
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view their own tasks" on public.tasks;
create policy "Users can view their own tasks"
  on public.tasks for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own tasks" on public.tasks;
create policy "Users can create their own tasks"
  on public.tasks for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
  on public.tasks for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
  on public.tasks for delete
  using ((select auth.uid()) = user_id);

-- Supabase Realtime powers the dashboard's live task stream.
alter table public.tasks replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
