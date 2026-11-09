-- ============================================================
-- Just Build client portal: database setup (Supabase)
-- Run once in the Supabase dashboard: SQL Editor -> New query ->
-- paste this whole file -> Run.
--
-- What it creates
--   profiles   one row per login (Steve = 'admin', clients = 'client')
--   projects   one per client project (dates, stage, next site visit)
--   updates    progress posts Steve writes for a project (+ photo path)
--   enquiries  contact-form submissions from the public website
--   storage    private 'update-photos' bucket for update photos
--
-- Who can see what (row-level security)
--   Steve (admin)  everything
--   A client       only their own project, its updates and photos
--   The public     can only SEND an enquiry; cannot read anything
-- ============================================================

-- ---------- Tables ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique not null,
  name       text not null default '',
  role       text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text not null default '',
  start_date    date,
  end_date      date,
  current_stage int  not null default 0 check (current_stage between 0 and 7),
  client_id     uuid references public.profiles (id) on delete set null,
  visit_date    date,
  visit_items   text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table if not exists public.updates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  date        date not null default current_date,
  title       text not null,
  body        text not null default '',
  image_path  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.enquiries (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 200),
  email         text not null check (char_length(email) between 3 and 320),
  project_type  text not null default '' check (char_length(project_type) <= 100),
  message       text not null default '' check (char_length(message) <= 5000),
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- Helper: is the signed-in user Steve? ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Row-level security ----------
alter table public.profiles  enable row level security;
alter table public.projects  enable row level security;
alter table public.updates   enable row level security;
alter table public.enquiries enable row level security;

-- profiles
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: admin writes" on public.profiles;
create policy "profiles: admin writes" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- projects
drop policy if exists "projects: read own or admin" on public.projects;
create policy "projects: read own or admin" on public.projects
  for select to authenticated using (client_id = auth.uid() or public.is_admin());
drop policy if exists "projects: admin writes" on public.projects;
create policy "projects: admin writes" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- updates
drop policy if exists "updates: read own or admin" on public.updates;
create policy "updates: read own or admin" on public.updates
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
  );
drop policy if exists "updates: admin writes" on public.updates;
create policy "updates: admin writes" on public.updates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- enquiries: anyone may send one; only Steve may read, mark or delete
drop policy if exists "enquiries: anyone can send" on public.enquiries;
create policy "enquiries: anyone can send" on public.enquiries
  for insert to anon, authenticated with check (true);
drop policy if exists "enquiries: admin reads" on public.enquiries;
create policy "enquiries: admin reads" on public.enquiries
  for select to authenticated using (public.is_admin());
drop policy if exists "enquiries: admin updates" on public.enquiries;
create policy "enquiries: admin updates" on public.enquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "enquiries: admin deletes" on public.enquiries;
create policy "enquiries: admin deletes" on public.enquiries
  for delete to authenticated using (public.is_admin());

-- ---------- Photos: private bucket, files stored as <project_id>/<file> ----------
insert into storage.buckets (id, name, public)
values ('update-photos', 'update-photos', false)
on conflict (id) do nothing;

drop policy if exists "photos: admin writes" on storage.objects;
create policy "photos: admin writes" on storage.objects
  for all to authenticated
  using (bucket_id = 'update-photos' and public.is_admin())
  with check (bucket_id = 'update-photos' and public.is_admin());

drop policy if exists "photos: client reads own project" on storage.objects;
create policy "photos: client reads own project" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'update-photos'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1] and p.client_id = auth.uid()
    )
  );

-- ---------- Steve can reset a client's password from his dashboard ----------
-- Only works for Steve (admin), only on client logins, minimum 8 characters.
create or replace function public.admin_set_password(target uuid, new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the studio can reset passwords';
  end if;
  if char_length(new_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if not exists (select 1 from public.profiles where id = target and role = 'client') then
    raise exception 'Not a client login';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target;
end;
$$;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- ============================================================
-- AFTER creating Steve's login (Authentication -> Users -> Add user,
-- email  steve@users.justbuild.com.sg , tick "Auto Confirm User"),
-- run this once to make that login the admin:
--
--   insert into public.profiles (id, username, name, role)
--   select id, 'steve', 'Steve', 'admin' from auth.users
--   where email = 'steve@users.justbuild.com.sg'
--   on conflict (id) do update set role = 'admin';
-- ============================================================
