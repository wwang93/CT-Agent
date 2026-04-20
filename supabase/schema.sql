create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  role text not null,
  user_id text not null,
  course_id text not null,
  week_number integer,
  assignment_id text,
  session_id text,
  turn_index integer,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists events_course_week_assignment_idx
  on public.events (course_id, week_number, assignment_id, created_at);

create index if not exists events_role_type_idx
  on public.events (role, type, created_at);

create table if not exists public.course_templates (
  course_id text not null,
  week_number integer not null,
  assignment_id text not null,
  templates text[] not null default '{}',
  scaffolds jsonb,
  active_template_index integer not null default 0,
  template_version integer not null default 1,
  course_goal text not null,
  assignment_type text not null,
  cultural_context text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (course_id, week_number, assignment_id)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'instructor', 'researcher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx
  on public.profiles (role);
