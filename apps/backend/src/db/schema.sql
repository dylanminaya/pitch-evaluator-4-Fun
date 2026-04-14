-- App tables for pitch-evaluator
-- Run after: just db-migrate (which creates better-auth tables)

CREATE TABLE IF NOT EXISTS event (
  id            TEXT        PRIMARY KEY,
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  criteria      JSONB       NOT NULL DEFAULT '[
    {"id":"innovation","label":"Innovacion","weight":25,"isDefault":true},
    {"id":"viability","label":"Viabilidad","weight":25,"isDefault":true},
    {"id":"impact","label":"Impacto","weight":25,"isDefault":true},
    {"id":"presentation","label":"Presentacion","weight":25,"isDefault":true}
  ]'::jsonb,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "organizerId" TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pitch (
  id            TEXT        PRIMARY KEY,
  "eventId"     TEXT        NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  color         TEXT        NOT NULL,
  "logoUrl"     TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vote (
  id            TEXT        PRIMARY KEY,
  "pitchId"     TEXT        NOT NULL REFERENCES pitch(id) ON DELETE CASCADE,
  "evaluatorId" TEXT,
  "ipAddress"   TEXT,
  "criteriaScores" JSONB    NOT NULL DEFAULT '[]'::jsonb,
  innovation    INTEGER     NOT NULL CHECK (innovation BETWEEN 1 AND 5),
  viability     INTEGER     NOT NULL CHECK (viability BETWEEN 1 AND 5),
  impact        INTEGER     NOT NULL CHECK (impact BETWEEN 1 AND 5),
  presentation  INTEGER     NOT NULL CHECK (presentation BETWEEN 1 AND 5),
  comment       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("pitchId", "ipAddress")
);
