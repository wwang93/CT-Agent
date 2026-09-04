-- Run AFTER schema.sql, on a NEW, isolated Supabase project for this course.
-- Do not apply to the original CT-Agent production project without a review.
-- Browser access must go through authenticated, role-checked server endpoints.
begin;
alter table public.profiles enable row level security;
alter table public.course_templates enable row level security;
alter table public.events enable row level security;
revoke all on public.profiles from anon, authenticated;
revoke all on public.course_templates from anon, authenticated;
revoke all on public.events from anon, authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.course_templates to service_role;
grant select, insert, update, delete on public.events to service_role;
create index if not exists education_owner_idx
  on public.course_templates (course_id, updated_by, assignment_id);
commit;

-- Bootstrap ONLY verified staff using their exact auth.users UUID.
-- insert into public.profiles (user_id, role)
-- values ('VERIFIED-AUTH-USER-UUID', 'instructor')
-- on conflict (user_id) do update set role = excluded.role;
-- Create a separate verified account with role 'researcher' if approved.
