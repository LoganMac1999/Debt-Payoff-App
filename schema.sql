-- Freedom: Debt Payoff Planner schema
-- Run this in Supabase SQL Editor

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Household',
  created_at timestamptz default now()
);

create table household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (household_id, user_id)
);

create table debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  balance numeric not null,
  apr numeric not null default 0,
  min_payment numeric not null default 0,
  promo_months int not null default 0, -- 0 = no promo; otherwise, months remaining at 0% before reverting to apr
  due_day int not null default 1, -- day of month (1-28) this debt's payment is due
  sort_order int default 0,
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid references debts(id) on delete cascade,
  amount numeric not null,
  type text not null default 'payment' check (type in ('payment', 'charge')),
  paid_on date not null default current_date,
  note text,
  created_at timestamptz default now()
);

create table household_settings (
  household_id uuid primary key references households(id) on delete cascade,
  strategy text not null default 'avalanche', -- 'avalanche' | 'snowball' | 'efficiency'
  extra_monthly numeric not null default 0
);

create table task_completions (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid references debts(id) on delete cascade,
  period text not null, -- 'YYYY-MM', the calendar month this task belongs to
  completed boolean not null default false,
  completed_at timestamptz,
  unique (debt_id, period)
);

alter table households enable row level security;
alter table household_members enable row level security;
alter table debts enable row level security;
alter table payments enable row level security;
alter table household_settings enable row level security;
alter table task_completions enable row level security;

create or replace function is_household_member(h_id uuid)
returns boolean as $$
  select exists (
    select 1 from household_members
    where household_id = h_id and user_id = auth.uid()
  );
$$ language sql security definer;

create policy "members can view their household" on households
  for select using (is_household_member(id));

create policy "members can view membership" on household_members
  for select using (user_id = auth.uid() or is_household_member(household_id));
create policy "users can join via invite handled in app" on household_members
  for insert with check (user_id = auth.uid());

create policy "members can manage debts" on debts
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "members can manage payments" on payments
  for all using (is_household_member((select household_id from debts where id = debt_id)))
  with check (is_household_member((select household_id from debts where id = debt_id)));

create policy "members can manage settings" on household_settings
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "members can manage task completions" on task_completions
  for all using (is_household_member((select household_id from debts where id = debt_id)))
  with check (is_household_member((select household_id from debts where id = debt_id)));
