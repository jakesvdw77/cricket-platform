-- docs/specs/119-login-account-journey.md, Part 3 (slice 3): where a Person came from, the agent-to-player links,
-- the typed link requests waiting for a club decision, and the attempt counters for rate limiting.

-- Existing rows are CLUB_CREATED; 016 provisioning writes INVITED, self-registration SELF_REGISTERED.
ALTER TABLE person ADD COLUMN origin VARCHAR(20) NOT NULL DEFAULT 'CLUB_CREATED';
ALTER TABLE person ADD CONSTRAINT ck_person_origin CHECK (origin IN ('CLUB_CREATED', 'INVITED', 'SELF_REGISTERED'));

-- The email match reads player_profile by lower(email) across clubs.
CREATE INDEX ix_player_profile_email_lower ON player_profile (lower(email));

-- "This account is an agent for this player at this club." Club-scoped. Only ACTIVE grants anything.
CREATE TABLE person_link (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_person_id    UUID REFERENCES person (id),
    invited_email        VARCHAR(255),
    subject_person_id    UUID         NOT NULL REFERENCES person (id),
    club_id              UUID         NOT NULL REFERENCES club (id),
    status               VARCHAR(20)  NOT NULL,
    is_main              BOOLEAN      NOT NULL DEFAULT FALSE,
    make_main            BOOLEAN      NOT NULL DEFAULT FALSE,
    granted_via          VARCHAR(20)  NOT NULL,
    granted_by_person_id UUID REFERENCES person (id),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    decided_at           TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    revoked_at           TIMESTAMPTZ,
    revoked_by_person_id UUID REFERENCES person (id),
    CONSTRAINT ck_person_link_status CHECK (status IN ('INVITED', 'ACTIVE', 'REVOKED', 'DECLINED')),
    CONSTRAINT ck_person_link_granted_via CHECK (granted_via IN ('EMAIL_MATCH', 'CLUB_APPROVAL', 'AGENT_INVITE', 'CLUB_MANAGER')),
    CONSTRAINT ck_person_link_target CHECK (account_person_id IS NOT NULL OR invited_email IS NOT NULL),
    CONSTRAINT ck_person_link_not_self CHECK (account_person_id <> subject_person_id)
);
-- At most one active main agent per player at a club.
CREATE UNIQUE INDEX ux_person_link_one_main ON person_link (subject_person_id, club_id)
    WHERE is_main AND status = 'ACTIVE';
CREATE UNIQUE INDEX ux_person_link_open ON person_link (account_person_id, subject_person_id, club_id)
    WHERE status IN ('INVITED', 'ACTIVE');
CREATE INDEX ix_person_link_account ON person_link (account_person_id);
CREATE INDEX ix_person_link_subject_club ON person_link (subject_person_id, club_id);

-- Untrusted input waiting for a human at the club.
CREATE TABLE link_request (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_person_id          UUID         NOT NULL REFERENCES person (id),
    club_id                    UUID         NOT NULL REFERENCES club (id),
    typed_first_name           VARCHAR(255) NOT NULL,
    typed_last_name            VARCHAR(255) NOT NULL,
    typed_date_of_birth        DATE         NOT NULL,
    target_player_profile_id   UUID REFERENCES player_profile (id),
    message                    VARCHAR(500),
    status                     VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    resolved_subject_person_id UUID REFERENCES person (id),
    decided_by_person_id       UUID REFERENCES person (id),
    decided_at                 TIMESTAMPTZ,
    decision_note              VARCHAR(500),
    requester_notified_at      TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_link_request_status CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED'))
);
CREATE INDEX ix_link_request_club_status ON link_request (club_id, status);
CREATE INDEX ix_link_request_account ON link_request (account_person_id);

-- Rate limiting and lockout, the 077 pattern: one row per (account, kind).
CREATE TABLE link_attempt (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_person_id UUID        NOT NULL REFERENCES person (id),
    kind              VARCHAR(20) NOT NULL,
    count             INTEGER     NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL,
    locked_until      TIMESTAMPTZ,
    CONSTRAINT ck_link_attempt_kind CHECK (kind IN ('CONFIRM', 'REQUEST', 'INVITE')),
    CONSTRAINT ux_link_attempt UNIQUE (account_person_id, kind)
);
