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
create policy "public read committees"    on public.committees    for select using (true);
create policy "public read projects"      on public.projects      for select using (true);
create policy "public read highlights"    on public.highlights    for select using (true);
create policy "public read exec_board"    on public.exec_board    for select using (true);
create policy "public read site_settings" on public.site_settings for select using (true);

-- only listed admins can write content
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

create policy "admin write site_settings" on public.site_settings for all to authenticated
  using    (public.is_admin())
  with check (public.is_admin());

-- admins can read the admin list
create policy "admin read admin_users"    on public.admin_users   for select to authenticated
  using (public.is_admin());
