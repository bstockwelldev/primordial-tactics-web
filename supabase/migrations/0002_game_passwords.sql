-- Optional join password per game, with an atomic guess limiter.
-- Additive and nullable: the previous app version keeps working against this schema,
-- so apply this BEFORE deploying the code that uses it.
-- The tables are already hidden from the public roles (see 0001), so password_hash is never exposed by PostgREST.

alter table public.games
  add column password_hash      text,
  add column join_attempts      int not null default 0,
  add column join_window_start  timestamptz;
