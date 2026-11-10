-- Async multiplayer: players, games, push subscriptions.
-- Reached only from the server (service key). RLS is enabled with no policies,
-- so the browser-facing anon/authenticated roles can read and write nothing.

create table public.players (
  id          uuid primary key,
  name        text not null check (char_length(name) between 1 and 40),
  token_hash  text not null unique,
  created_at  timestamptz not null default now()
);

create table public.games (
  id                uuid primary key,
  status            text not null check (status in ('waiting', 'in_progress', 'completed')),
  visibility        text not null check (visibility in ('open', 'invite')),
  host_id           uuid not null references public.players (id),
  guest_id          uuid references public.players (id),
  active_player_id  uuid references public.players (id),
  turn_number       int  not null default 1,
  turn_hours        int  not null default 24 check (turn_hours in (8, 24, 72)),
  turn_deadline     timestamptz,
  host_timeouts     int  not null default 0,
  guest_timeouts    int  not null default 0,
  winner_id         uuid references public.players (id),
  end_reason        text check (end_reason in ('elimination', 'forfeit', 'resign', 'draw')),
  state             jsonb not null,
  version           int  not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index games_host_status_idx     on public.games (host_id, status);
create index games_guest_status_idx    on public.games (guest_id, status);
create index games_open_idx            on public.games (status, visibility, created_at desc);
create index games_deadline_idx        on public.games (turn_deadline) where status = 'in_progress';
create index games_active_player_idx   on public.games (active_player_id);
create index games_winner_idx          on public.games (winner_id);

create table public.push_subscriptions (
  endpoint    text primary key,
  player_id   uuid not null references public.players (id) on delete cascade,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_player_idx on public.push_subscriptions (player_id);

alter table public.players            enable row level security;
alter table public.games              enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on public.players, public.games, public.push_subscriptions from anon, authenticated;
