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
alter table public.site_settings enable row level security;
alter table public.admin_users   enable row level security;

-- public can read content (the public site needs it)
create policy "public read committees"    on public.committees    for select using (true);
create policy "public read projects"      on public.projects      for select using (true);
create policy "public read site_settings" on public.site_settings for select using (true);

-- only listed admins can write content
create policy "admin write committees"    on public.committees    for all to authenticated
  using    (exists (select 1 from public.admin_users a where a.id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.id = auth.uid()));

create policy "admin write projects"      on public.projects      for all to authenticated
  using    (exists (select 1 from public.admin_users a where a.id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.id = auth.uid()));

create policy "admin write site_settings" on public.site_settings for all to authenticated
  using    (exists (select 1 from public.admin_users a where a.id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.id = auth.uid()));

-- admins can read the admin list
create policy "admin read admin_users"    on public.admin_users   for select to authenticated
  using (exists (select 1 from public.admin_users a where a.id = auth.uid()));
