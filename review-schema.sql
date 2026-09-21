-- Render Consistency - review notes
-- Run once in the Supabase SQL editor (left sidebar -> SQL Editor -> New query).

create table if not exists public.review_notes (
  key        text primary key,          -- "<project>/<example>", e.g. mismo/04
  state      text,                      -- 'good' | 'edit' | null
  note       text,
  author     text,                      -- whatever the reviewer typed as their name
  updated_at timestamptz not null default now()
);

alter table public.review_notes enable row level security;

-- The site is public and has no login, so the anon key is what every
-- reviewer uses. These policies deliberately allow anyone with the page to
-- read and write THIS TABLE ONLY - nothing else in the database is exposed.
-- There is no delete policy: clearing a mark empties the row, it never
-- removes one, so nobody can wipe another reviewer's note.

drop policy if exists "review read"   on public.review_notes;
drop policy if exists "review insert" on public.review_notes;
drop policy if exists "review update" on public.review_notes;

create policy "review read"
  on public.review_notes for select
  using (true);

create policy "review insert"
  on public.review_notes for insert
  with check (true);

create policy "review update"
  on public.review_notes for update
  using (true) with check (true);

-- Keep updated_at honest even when a client forgets to send it.
create or replace function public.review_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists review_touch on public.review_notes;
create trigger review_touch
  before insert or update on public.review_notes
  for each row execute function public.review_touch();
