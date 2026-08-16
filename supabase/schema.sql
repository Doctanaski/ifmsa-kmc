-- ============================================================
-- IFMSA KMC — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- After creating your admin account, grant yourself admin:
--   INSERT INTO admin_users (id) VALUES ('<your auth user id>');
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- committees ----------
create table if not exists public.committees (
  slug       text primary key,
  acronym    text not null,
  name       text not null,
  color      text,
  accent     text,
  logo       text,
  sort_order int  not null default 0
);

-- ---------- projects ----------
create table if not exists public.projects (
  id         text primary key,
  committee  text not null references public.committees (slug) on delete cascade,
  title      text not null,
  type       text,
  status     text,
  timeframe  text,
  theme      text,
  summary    text,
  about      jsonb not null default '[]'::jsonb,
  goals      jsonb not null default '[]'::jsonb,
  sort_order int  not null default 0
);

-- ---------- highlights (stories behind the projects) ----------
create table if not exists public.highlights (
  id         text primary key,
  category   text not null default 'campus',   -- away | campus | win
  tag        text,
  title      text not null,
  date       text,
  location   text,
  committee  text,
  summary    text,
  about      jsonb not null default '[]'::jsonb,
  featured   boolean not null default false,
  sort_order int  not null default 0
);

-- ---------- executive board (Meet the Executive Board page) ----------
create table if not exists public.exec_board (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null,
  photo      text,
  quote      text,
  sort_order int  not null default 0
);

-- ---------- alumni (Where they are now page) ----------
create table if not exists public.alumni (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  cohort     text,                        -- e.g. "Batch of 2018"
  track      text,                        -- Clinical | Research | Public Health | Leadership | Beyond Medicine
  role_now   text,                        -- current position
  location   text,                        -- city, country
  specialty  text,
  committees text,                        -- committee acronyms, comma separated
  photo      text,
  quote      text,                        -- short line shown on the card
  story      jsonb not null default '[]'::jsonb, -- paragraphs + ![caption](url) image lines
  links      jsonb not null default '{}'::jsonb, -- { linkedin, twitter, email }
  featured   boolean not null default false,
  sort_order int  not null default 0
);

-- ---------- awards (Achievements & Awards page) ----------
create table if not exists public.awards (
  id         text primary key,
  category   text not null default 'project', -- officer | project | research | international | national | community
  title      text not null,
  awardee    text,                        -- person / project / partner honoured, or authors for a paper
  role       text,                        -- subtitle, e.g. "Local Officer — SCOPH"
  year       text,                        -- "2026"
  location   text,
  source     text,                        -- journal / assembly / body that granted it
  link       text,                        -- DOI or external URL
  summary    text,                        -- short line shown on the card
  about      jsonb not null default '[]'::jsonb, -- paragraphs + ![caption](url) image lines
  medal      text,                        -- gold | silver | bronze
  featured   boolean not null default false,
  sort_order int  not null default 0
);

-- ---------- site settings (key -> json value) ----------
create table if not exists public.site_settings (
  key   text primary key,
  value jsonb not null
);

-- ---------- admin users (auth user ids allowed to write) ----------
create table if not exists public.admin_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- row level security ----------
alter table public.committees    enable row level security;
alter table public.projects      enable row level security;
alter table public.highlights    enable row level security;
alter table public.exec_board    enable row level security;
alter table public.alumni        enable row level security;
alter table public.awards        enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_users   enable row level security;

-- security definer helper so admin checks don't trigger RLS recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admin_users a where a.id = auth.uid());
$$;

-- public can read content (the public site needs it)
drop policy if exists "public read committees"    on public.committees;
drop policy if exists "public read projects"      on public.projects;
drop policy if exists "public read highlights"    on public.highlights;
drop policy if exists "public read exec_board"    on public.exec_board;
drop policy if exists "public read alumni"        on public.alumni;
drop policy if exists "public read awards"        on public.awards;
drop policy if exists "public read site_settings" on public.site_settings;

create policy "public read committees"    on public.committees    for select using (true);
create policy "public read projects"      on public.projects      for select using (true);
create policy "public read highlights"    on public.highlights    for select using (true);
create policy "public read exec_board"    on public.exec_board    for select using (true);
create policy "public read alumni"        on public.alumni        for select using (true);
create policy "public read awards"        on public.awards        for select using (true);
create policy "public read site_settings" on public.site_settings for select using (true);

-- only listed admins can write content
drop policy if exists "admin write committees"    on public.committees;
drop policy if exists "admin write projects"      on public.projects;
drop policy if exists "admin write highlights"    on public.highlights;
drop policy if exists "admin write exec_board"    on public.exec_board;
drop policy if exists "admin write alumni"        on public.alumni;
drop policy if exists "admin write awards"        on public.awards;
drop policy if exists "admin write site_settings" on public.site_settings;

create policy "admin write committees"    on public.committees    for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin write projects"      on public.projects      for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin write highlights"    on public.highlights    for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin write exec_board"    on public.exec_board    for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin write alumni"        on public.alumni        for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin write awards"        on public.awards        for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

create policy "admin write site_settings" on public.site_settings for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

-- admins can read the admin list
drop policy if exists "admin read admin_users" on public.admin_users;

create policy "admin read admin_users"    on public.admin_users   for select to authenticated
  using (public.is_admin());
