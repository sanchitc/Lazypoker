// Append-only list. Never edit a past entry; add a new one.
export const migrations: { name: string; sql: string }[] = [
  {
    name: '0001_init',
    sql: `
CREATE TABLE IF NOT EXISTS players (
  player_key      TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hands (
  id              BIGSERIAL PRIMARY KEY,
  room_code       TEXT NOT NULL,
  hand_number     INT  NOT NULL,
  mode            TEXT NOT NULL,
  small_blind     INT  NOT NULL,
  big_blind       INT  NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  board_cards     JSONB,
  winner_keys     TEXT[],
  pot_total       INT,
  num_players     INT  NOT NULL
);

CREATE INDEX IF NOT EXISTS hands_room_idx ON hands (room_code, started_at DESC);

CREATE TABLE IF NOT EXISTS actions (
  id              BIGSERIAL PRIMARY KEY,
  hand_id         BIGINT REFERENCES hands(id) ON DELETE CASCADE,
  room_code       TEXT NOT NULL,
  seq             INT  NOT NULL,
  player_key      TEXT REFERENCES players(player_key),
  player_id       TEXT NOT NULL,
  player_name     TEXT NOT NULL,
  action_type     TEXT NOT NULL,
  amount          INT,
  phase           TEXT NOT NULL,
  betting_round   INT,
  chips_before    INT  NOT NULL,
  chips_after     INT  NOT NULL,
  current_bet     INT  NOT NULL,
  pot_total       INT  NOT NULL,
  hole_cards      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actions_hand_idx      ON actions (hand_id, seq);
CREATE INDEX IF NOT EXISTS actions_player_idx    ON actions (player_key, created_at DESC);
CREATE INDEX IF NOT EXISTS actions_room_time_idx ON actions (room_code, created_at DESC);
`,
  },
  {
    name: '0002_teen_patti_variant',
    sql: `
ALTER TABLE hands ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT 'poker';
`,
  },
];
