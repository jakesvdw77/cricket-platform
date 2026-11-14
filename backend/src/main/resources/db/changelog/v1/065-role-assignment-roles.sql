-- docs/specs/150-managers-and-access-grants.md: a grant now points at a role (a bundle of permissions).
ALTER TABLE role_assignment ADD COLUMN access_role_id        UUID REFERENCES access_role(id);
ALTER TABLE role_assignment ADD COLUMN granted_by_person_id  UUID REFERENCES person(id);
ALTER TABLE role_assignment ADD COLUMN invitation_sent_at    TIMESTAMPTZ;

-- Every existing club or section manager grant becomes the Manager role at the same place: nobody gains or loses access.
UPDATE role_assignment
   SET access_role_id = '00000000-0000-4000-a000-000000000001'
 WHERE role = 'CLUB_ADMIN';

-- A person may hold several roles at one place (for example Scorer and Team Manager), so the role joins the key.
DROP INDEX ux_role_assignment_grant;
CREATE UNIQUE INDEX ux_role_assignment_grant
    ON role_assignment (
        person_id,
        COALESCE(access_role_id, '00000000-0000-0000-0000-000000000000'),
        role,
        scope_type,
        COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'));
