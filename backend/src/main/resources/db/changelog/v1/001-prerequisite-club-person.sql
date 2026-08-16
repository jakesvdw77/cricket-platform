-- Minimal prerequisite for spec 004-landing-page.md's foreign keys and platform_admin auth.
-- NOT the full entity model from docs/specs/001-tenancy-identity-model.md — no Section, Team,
-- ClubMembership, or RoleAssignment yet. Those land when 001 itself is implemented.

CREATE TABLE club (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ONBOARDING'
);

CREATE TABLE person (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id VARCHAR(255) UNIQUE,
    full_name VARCHAR(255)
);
