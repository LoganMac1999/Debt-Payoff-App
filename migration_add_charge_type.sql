-- Run this if you already executed the original schema.sql before this update.
-- Safe to run even on a fresh database (the IF NOT EXISTS guards skip it).

alter table payments add column if not exists type text not null default 'payment';
alter table payments drop constraint if exists payments_type_check;
alter table payments add constraint payments_type_check check (type in ('payment', 'charge'));

alter table debts add column if not exists promo_months int not null default 0;
alter table debts add column if not exists due_day int not null default 1;

create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid references debts(id) on delete cascade,
  period text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (debt_id, period)
);
alter table task_completions enable row level security;
drop policy if exists "members can manage task completions" on task_completions;
create policy "members can manage task completions" on task_completions
  for all using (is_household_member((select household_id from debts where id = debt_id)))
  with check (is_household_member((select household_id from debts where id = debt_id)));
