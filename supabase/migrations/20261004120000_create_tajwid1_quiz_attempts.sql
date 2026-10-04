create table if not exists public.tajwid1_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  student_name text not null check (char_length(student_name) between 1 and 80),
  student_group text not null check (char_length(student_group) between 1 and 60),
  lesson_id smallint not null check (lesson_id between 1 and 25),
  lesson_title text not null check (char_length(lesson_title) between 1 and 160),
  score smallint not null check (score between 0 and 7),
  total smallint not null default 7 check (total = 7),
  percent smallint not null check (percent between 0 and 100),
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  attempt_id text not null unique check (char_length(attempt_id) between 1 and 80),
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) = 7)
);

create index if not exists tajwid1_quiz_attempts_submitted_at_idx
  on public.tajwid1_quiz_attempts (submitted_at desc);

create index if not exists tajwid1_quiz_attempts_group_lesson_idx
  on public.tajwid1_quiz_attempts (student_group, lesson_id);

alter table public.tajwid1_quiz_attempts enable row level security;
revoke all on table public.tajwid1_quiz_attempts from anon, authenticated;
grant all on table public.tajwid1_quiz_attempts to service_role;
