-- Safe to run on every start: nothing here touches fighters, votes, or head-to-head totals.
-- STRICT makes SQLite reject values of the wrong type instead of storing them anyway.
--
-- D1 bills per row read, so every request should touch a small, fixed number of rows no matter how
-- many fighters or votes there are. Totals live on the rows they describe (a fighter's wins, a
-- pair's head-to-head) and are updated by each vote, instead of being counted from `vote` later.

CREATE TABLE IF NOT EXISTS fighter (
  fighter_id    TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  short_name    TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('people', 'fictional', 'animals', 'objects')),
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  emoji         TEXT,
  image_url     TEXT,
  weight_kg     REAL NOT NULL CHECK (weight_kg > 0),
  height_cm     INTEGER CHECK (height_cm > 0),
  age           INTEGER CHECK (age >= 0),
  secret_weapon TEXT NOT NULL,
  weakness      TEXT NOT NULL,
  elo           INTEGER NOT NULL DEFAULT 1000,
  -- The rating from the CSV. The nightly refit pulls lightly toward it.
  start_elo     INTEGER NOT NULL DEFAULT 1000,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0
) STRICT;

-- Rankings pages and finding opponents with a similar rating.
CREATE INDEX IF NOT EXISTS fighter_elo_idx ON fighter (elo DESC, fighter_id);
-- Every vote changes two fighters' elo and wins, and each index on those columns costs extra row
-- writes per vote. Writes cost far more than reads, and a few hundred fighters are cheap to scan,
-- so category pages scan the table instead of keeping an index.
DROP INDEX IF EXISTS fighter_category_elo_idx;
DROP INDEX IF EXISTS fighter_games_idx;
-- Matchmaking favors fighters with fewer than 10 votes (SETTLED_GAMES in worker/ratings.ts). Only
-- they are in this index, so votes on settled fighters don't write to it.
-- Queries must repeat this exact WHERE clause for SQLite to use it.
CREATE INDEX IF NOT EXISTS fighter_unsettled_idx ON fighter (wins + losses) WHERE wins + losses < 10;

-- Head-to-head totals. A row appears the first time two fighters meet, so there is no table of
-- every possible pair. fighter_a_id is always the smaller id.
CREATE TABLE IF NOT EXISTS pair (
  fighter_a_id TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  fighter_b_id TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  a_wins       INTEGER NOT NULL DEFAULT 0,
  b_wins       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fighter_a_id, fighter_b_id),
  CHECK (fighter_a_id < fighter_b_id)
) STRICT, WITHOUT ROWID;

-- Served the removed "closest calls" feature.
DROP INDEX IF EXISTS pair_contested_idx;

-- Every vote, for the record and the nightly refit. Nothing reads it per request, so no indexes.
CREATE TABLE IF NOT EXISTS vote (
  vote_id      INTEGER PRIMARY KEY,
  fighter_a_id TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  fighter_b_id TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  winner_id    TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

-- Taken nightly. "This week" compares a fighter's place now with its place a week ago.
-- Snapshots older than about a week are deleted.
CREATE TABLE IF NOT EXISTS fighter_rating_snapshot (
  snapshot_date TEXT NOT NULL,
  fighter_id    TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  elo           INTEGER NOT NULL,
  rank          INTEGER NOT NULL,
  category_rank INTEGER NOT NULL,
  PRIMARY KEY (snapshot_date, fighter_id)
) STRICT, WITHOUT ROWID;

-- Held the removed "closest calls" feature, a cache rebuilt from `pair`, so nothing is lost.
DROP TABLE IF EXISTS closest_call;
