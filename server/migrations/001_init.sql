-- Users and roles
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  department    TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'faculty' CHECK (role IN ('faculty','rd','admin')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  must_reset    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reusable faculty profile (PI details, expertise, funded projects)
CREATE TABLE IF NOT EXISTS profiles (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proposals: form data in JSONB so new fields need no migration
CREATE TABLE IF NOT EXISTS proposals (
  id             SERIAL PRIMARY KEY,
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL DEFAULT '',
  agency         TEXT NOT NULL,
  scheme         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft',
  data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  ptext          TEXT NOT NULL DEFAULT '',
  file_name      TEXT,
  score          INTEGER,
  band           TEXT,
  evaluation     JSONB,
  ai_review      JSONB,
  ai_reviewed_at TIMESTAMPTZ,
  outcome_note   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposals_owner_idx ON proposals(owner_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals(status);

CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_proposal_idx ON comments(proposal_id);

CREATE TABLE IF NOT EXISTS status_history (
  id          SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  by_user     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Count of Claude reviews per user per day (for the daily limit)
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
