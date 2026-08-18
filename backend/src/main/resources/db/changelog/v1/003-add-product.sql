CREATE TABLE product (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code               VARCHAR(64) NOT NULL,
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    is_free            BOOLEAN NOT NULL DEFAULT false,
    price              NUMERIC(10,2),
    currency           VARCHAR(3),
    billing_interval   VARCHAR(16) NOT NULL DEFAULT 'MONTHLY',
    max_period_months  INTEGER,
    max_sections       INTEGER,
    max_teams          INTEGER,
    max_players        INTEGER,
    status             VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    display_order      INTEGER NOT NULL DEFAULT 0,
    show_ads           BOOLEAN NOT NULL DEFAULT false,
    allow_subdomain    BOOLEAN NOT NULL DEFAULT false,
    allow_whitelisting BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by         UUID
);

CREATE UNIQUE INDEX ux_product_code ON product (LOWER(code));
