-- docs/specs/015-person-status-and-role-assignment.md: RoleAssignment, one row per grant, per
-- docs/specs/001-tenancy-identity-model.md's original design.
CREATE TABLE role_assignment (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id   UUID NOT NULL REFERENCES person(id),
    role        VARCHAR(32) NOT NULL,
    scope_type  VARCHAR(16) NOT NULL,
    scope_id    UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_role_assignment_scope_id
        CHECK (scope_type = 'PLATFORM' OR scope_id IS NOT NULL)
);

CREATE INDEX ix_role_assignment_person ON role_assignment (person_id);
CREATE INDEX ix_role_assignment_scope ON role_assignment (scope_type, scope_id);

-- Prevents granting the exact same role at the exact same scope to the same person twice.
-- Postgres treats NULL as distinct in a unique index by default, so scope_id is coalesced to a
-- fixed sentinel UUID for PLATFORM-scoped rows (the only case scope_id is ever NULL) — otherwise
-- two identical PLATFORM grants for the same person/role would silently not collide.
CREATE UNIQUE INDEX ux_role_assignment_grant
    ON role_assignment (person_id, role, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'));
