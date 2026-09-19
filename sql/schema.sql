-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New query)

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  line_user_id text unique not null,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sort_order int default 0
);

insert into categories (name, sort_order)
select * from (values
  ('อาหาร', 1),
  ('ช้อปปิ้ง', 2),
  ('เดินทาง/น้ำมัน', 3),
  ('บันเทิง', 4),
  ('สุขภาพ', 5),
  ('บิล/ค่าใช้จ่ายประจำ', 6),
  ('ท่องเที่ยว', 7),
  ('อื่นๆ', 8)
) as v(name, sort_order)
where not exists (select 1 from categories);

create table if not exists cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  credit_limit numeric(12,2) not null default 0,
  cutoff_day int not null check (cutoff_day between 1 and 31),
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  category_id uuid references categories(id),
  amount numeric(12,2) not null,
  transaction_date date not null default current_date,
  note text,
  is_installment boolean default false,
  total_installments int,
  created_at timestamptz default now()
);

-- Every transaction (installment or not) expands into one or more billing_items,
-- each tagged with the statement (cycle_end_date) it belongs to. This makes all
-- summary queries a simple SUM ... GROUP BY, regardless of installments.
create table if not exists billing_items (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  category_id uuid references categories(id),
  cycle_end_date date not null,
  amount numeric(12,2) not null,
  installment_no int,
  created_at timestamptz default now()
);

create index if not exists idx_billing_items_card_cycle on billing_items (card_id, cycle_end_date);
create index if not exists idx_transactions_card on transactions (card_id);

-- Recurring monthly charges (Netflix, Spotify, etc). These are never
-- pre-generated into billing_items — the app computes at query time
-- whether a subscription's billing_day falls inside a given cycle.
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  category_id uuid references categories(id),
  name text not null,
  amount numeric(12,2) not null,
  billing_day int not null check (billing_day between 1 and 31),
  start_date date not null default current_date,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_subscriptions_card on subscriptions (card_id);

-- Tracks each LINE user's current step in a multi-step conversation (add card,
-- add transaction, etc). state = 'IDLE' when not mid-flow.
create table if not exists user_sessions (
  line_user_id text primary key,
  state text not null default 'IDLE',
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);
