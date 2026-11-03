-- Per-user data for SaleCrawler. Every row belongs to a Neon Auth user and is deleted with them.
-- Idempotent: safe to run more than once.

create table if not exists public.saved_leads (
  user_id      uuid        not null references neon_auth."user"(id) on delete cascade,
  lead_id      text        not null check (char_length(lead_id) between 1 and 64),
  name         text        not null check (char_length(name) between 1 and 200),
  website      text        check (char_length(website) <= 2048),
  phone        text        check (char_length(phone) <= 64),
  address      text        check (char_length(address) <= 300),
  category     text        check (char_length(category) <= 80),
  opportunity  smallint    check (opportunity between 0 and 100),
  verdict      text        check (verdict in ('prime', 'warm', 'saturated')),
  missing      text[]      not null default '{}' check (cardinality(missing) <= 20),
  status       text        not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  notes        text        not null default '' check (char_length(notes) <= 2000),
  saved_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, lead_id)
);
create index if not exists saved_leads_user_updated on public.saved_leads (user_id, updated_at desc);

create table if not exists public.search_history (
  id            bigint generated always as identity primary key,
  user_id       uuid        not null references neon_auth."user"(id) on delete cascade,
  city          text        not null check (char_length(city) between 1 and 120),
  niche         text        not null check (char_length(niche) between 1 and 60),
  radius_m      integer     not null check (radius_m in (2000, 5000, 10000)),
  place_label   text        check (char_length(place_label) <= 200),
  result_count  integer     not null check (result_count between 0 and 1000),
  created_at    timestamptz not null default now()
);
create index if not exists search_history_user_created on public.search_history (user_id, created_at desc);

create table if not exists public.audit_history (
  id             bigint generated always as identity primary key,
  user_id        uuid        not null references neon_auth."user"(id) on delete cascade,
  lead_id        text        not null check (char_length(lead_id) between 1 and 64),
  business_name  text        not null check (char_length(business_name) between 1 and 200),
  url            text        check (char_length(url) <= 2048),
  opportunity    smallint    not null check (opportunity between 0 and 100),
  verdict        text        not null check (verdict in ('prime', 'warm', 'saturated')),
  missing        text[]      not null default '{}' check (cardinality(missing) <= 20),
  created_at     timestamptz not null default now()
);
create index if not exists audit_history_user_created on public.audit_history (user_id, created_at desc);
