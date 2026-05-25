-- OfferGlow SQL Schema
-- Paste this into your Supabase SQL Editor (https://supabase.com) to initialize the database tables.

-- 1. Enable UUID Extension if not already enabled
create extension if not exists "uuid-ossp";

-- 2. Create drafts table
create table if not exists public.drafts (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  profile jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3. Create published_pages table
create table if not exists public.published_pages (
  id text primary key,
  user_id uuid references auth.users on delete set null,
  title text not null,
  html text not null,
  visits integer default 0 not null,
  created_at timestamptz default now() not null
);

-- 4. Create visit counter increment function (RPC)
create or replace function public.increment_page_visits(page_id text)
returns void as $$
begin
  update public.published_pages
  set visits = visits + 1
  where id = page_id;
end;
$$ language plpgsql security definer;

-- 5. Set up Row Level Security (RLS) policies
-- Enable RLS on drafts
alter table public.drafts enable row level security;

create policy "Users can perform all actions on their own drafts"
  on public.drafts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable RLS on published_pages
alter table public.published_pages enable row level security;

create policy "Anyone can read published pages"
  on public.published_pages
  for select
  to anon, authenticated
  using (true);

create policy "Users can modify their own published pages"
  on public.published_pages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Allow public anonymous page creation for compatibility"
  on public.published_pages
  for insert
  to anon, authenticated
  with check (true);
