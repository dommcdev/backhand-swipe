CREATE TABLE IF NOT EXISTS fighter (
  fighter_id    TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  short_name    TEXT NOT NULL,
  category      TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  emoji         TEXT,
  image_url     TEXT,
  weight_kg     REAL NOT NULL,
  height_cm     INTEGER,
  age           INTEGER,
  elo           INTEGER NOT NULL DEFAULT 1000,
  start_elo     INTEGER NOT NULL DEFAULT 1000,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS fighter_elo_idx ON fighter (elo DESC, fighter_id);

-- Only fighters with fewer than 10 votes, so matchmaking can find new fighters quickly.
CREATE INDEX IF NOT EXISTS fighter_unsettled_idx ON fighter (wins + losses) WHERE wins + losses < 10;

-- Head-to-head totals between two fighters. fighter_a_id is always the smaller id.
CREATE TABLE IF NOT EXISTS pair (
  fighter_a_id TEXT NOT NULL REFERENCES fighter (fighter_id) ON DELETE CASCADE,
  fighter_b_id TEXT NOT NULL REFERENCES fighter (fighter_id) ON DELETE CASCADE,
  a_wins       INTEGER NOT NULL DEFAULT 0,
  b_wins       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fighter_a_id, fighter_b_id)
);

CREATE TABLE IF NOT EXISTS vote (
  vote_id      INTEGER PRIMARY KEY,
  fighter_a_id TEXT NOT NULL REFERENCES fighter (fighter_id) ON DELETE CASCADE,
  fighter_b_id TEXT NOT NULL REFERENCES fighter (fighter_id) ON DELETE CASCADE,
  winner_id    TEXT NOT NULL REFERENCES fighter (fighter_id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Each fighter's place, saved nightly, for the "This week" column.
CREATE TABLE IF NOT EXISTS fighter_rating_snapshot (
  snapshot_date TEXT NOT NULL,
  fighter_id    TEXT NOT NULL REFERENCES fighter (fighter_id) ON DELETE CASCADE,
  elo           INTEGER NOT NULL,
  rank          INTEGER NOT NULL,
  category_rank INTEGER NOT NULL,
  PRIMARY KEY (snapshot_date, fighter_id)
);

