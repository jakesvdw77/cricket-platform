-- docs/specs/014-subscription-responsible-contact.md: grows person from its minimal prerequisite
-- stub (id/keycloak_user_id/full_name) into a real identity shape. Safe as a single-step
-- migration with no backfill — person has zero rows today, so ADD COLUMN ... NOT NULL with no
-- default is valid.
ALTER TABLE person
    DROP COLUMN full_name,
    ADD COLUMN first_name VARCHAR(255) NOT NULL,
    ADD COLUMN last_name  VARCHAR(255) NOT NULL,
    ADD COLUMN email      VARCHAR(255) NOT NULL,
    ADD COLUMN phone      VARCHAR(32);

CREATE UNIQUE INDEX ux_person_email_lower ON person (lower(email));
