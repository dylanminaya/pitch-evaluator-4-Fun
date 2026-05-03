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

ALTER TABLE event
ADD COLUMN IF NOT EXISTS criteria JSONB NOT NULL DEFAULT '[
  {"id":"innovation","label":"Innovacion","weight":25,"isDefault":true},
  {"id":"viability","label":"Viabilidad","weight":25,"isDefault":true},
  {"id":"impact","label":"Impacto","weight":25,"isDefault":true},
  {"id":"presentation","label":"Presentacion","weight":25,"isDefault":true}
]'::jsonb;

CREATE TABLE IF NOT EXISTS pitch (
  id            TEXT        PRIMARY KEY,
  "eventId"     TEXT        NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  color         TEXT        NOT NULL,
  "logoUrl"     TEXT,
  "presentationUrl" TEXT,
  "presentationFileName" TEXT,
  "presentationContentType" TEXT,
  "presentationFile" BYTEA,
  "presentationPdf" BYTEA,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pitch
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN';

ALTER TABLE pitch
ADD COLUMN IF NOT EXISTS "presentationUrl" TEXT;

ALTER TABLE pitch
ADD COLUMN IF NOT EXISTS "presentationFileName" TEXT;

ALTER TABLE pitch
ADD COLUMN IF NOT EXISTS "presentationContentType" TEXT;

ALTER TABLE pitch
ADD COLUMN IF NOT EXISTS "presentationFile" BYTEA;

ALTER TABLE pitch
ADD COLUMN IF NOT EXISTS "presentationPdf" BYTEA;

CREATE TABLE IF NOT EXISTS vote (
  id            TEXT        PRIMARY KEY,
  "pitchId"     TEXT        NOT NULL REFERENCES pitch(id) ON DELETE CASCADE,
  "evaluatorId" TEXT,
  "evaluatorEmail" TEXT,
  "criteriaScores" JSONB    NOT NULL DEFAULT '[]'::jsonb,
  innovation    INTEGER     NOT NULL CHECK (innovation BETWEEN 1 AND 5),
  viability     INTEGER     NOT NULL CHECK (viability BETWEEN 1 AND 5),
  impact        INTEGER     NOT NULL CHECK (impact BETWEEN 1 AND 5),
  presentation  INTEGER     NOT NULL CHECK (presentation BETWEEN 1 AND 5),
  comment       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("pitchId", "evaluatorEmail")
);

ALTER TABLE vote
ADD COLUMN IF NOT EXISTS "criteriaScores" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE vote
ADD COLUMN IF NOT EXISTS "evaluatorEmail" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS vote_pitch_evaluator_email_unique
ON vote ("pitchId", "evaluatorEmail")
WHERE "evaluatorEmail" IS NOT NULL;


--tabla para el co-organizador
CREATE TABLE IF NOT EXISTS event_organizer (
  id                TEXT        PRIMARY KEY,
  "eventId"         TEXT        NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  "userId"          TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL DEFAULT 'ORGANIZER' CHECK (role IN ('ORGANIZER')),
  "invitedByUserId" TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("eventId", "userId")
);

--tabla para cuando envien el link de invitacion 
CREATE TABLE IF NOT EXISTS event_organizer_invitation (
  id                TEXT        PRIMARY KEY,
  "eventId"         TEXT        NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  role              TEXT        NOT NULL DEFAULT 'ORGANIZER' CHECK (role IN ('ORGANIZER')),
  token             TEXT        NOT NULL UNIQUE,
  status            TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED')),
  "invitedByUserId" TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
  "acceptedByUserId" TEXT       REFERENCES "user"(id) ON DELETE SET NULL,
  "expiresAt"       TIMESTAMPTZ NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--no enviar otra invitacion si ya le mandamos--
CREATE UNIQUE INDEX IF NOT EXISTS event_organizer_invitation_pending_unique
ON event_organizer_invitation ("eventId", email, status)
WHERE status = 'PENDING';
