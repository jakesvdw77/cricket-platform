CREATE TABLE subscription (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type   VARCHAR(16) NOT NULL DEFAULT 'CLUB',
    owner_id     UUID NOT NULL REFERENCES club(id),
    product_id   UUID NOT NULL REFERENCES product(id),
    status       VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date     DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID
);

CREATE UNIQUE INDEX ux_subscription_active_owner
    ON subscription (owner_type, owner_id)
    WHERE status = 'ACTIVE';

-- Supports the Club join in SubscriptionRepository.search/searchOrderByClubNameAsc, and the
-- list endpoint's default sort — both hot paths on every admin list request.
CREATE INDEX ix_subscription_owner_id ON subscription (owner_id);
CREATE INDEX ix_subscription_start_date ON subscription (start_date);
