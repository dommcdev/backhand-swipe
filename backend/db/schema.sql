-- Safe to run on every start: nothing here touches existing rows.
-- STRICT makes SQLite reject values of the wrong type instead of storing them anyway.

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
  elo           INTEGER NOT NULL DEFAULT 1000
) STRICT;

-- Each unordered pair appears once: fighter_a_id is always the smaller id.
CREATE TABLE IF NOT EXISTS matchup (
  matchup_id   INTEGER PRIMARY KEY,
  fighter_a_id TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  fighter_b_id TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  UNIQUE (fighter_a_id, fighter_b_id),
  CHECK (fighter_a_id < fighter_b_id)
) STRICT;

CREATE INDEX IF NOT EXISTS matchup_fighter_b_idx ON matchup (fighter_b_id);

-- winner_id must be one of the matchup's two fighters. A foreign key can't express that,
-- so the vote transaction in backend/src/api.ts checks it.
CREATE TABLE IF NOT EXISTS vote (
  vote_id    INTEGER PRIMARY KEY,
  matchup_id INTEGER NOT NULL REFERENCES matchup ON DELETE CASCADE,
  winner_id  TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX IF NOT EXISTS vote_matchup_winner_idx ON vote (matchup_id, winner_id);
CREATE INDEX IF NOT EXISTS vote_winner_idx ON vote (winner_id);

CREATE TABLE IF NOT EXISTS fighter_rating_snapshot (
  snapshot_date TEXT NOT NULL,
  fighter_id    TEXT NOT NULL REFERENCES fighter ON DELETE CASCADE,
  elo           INTEGER NOT NULL,
  PRIMARY KEY (snapshot_date, fighter_id)
) STRICT;
