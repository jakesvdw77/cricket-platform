-- docs/specs/014-subscription-responsible-contact.md: replaces Subscription's embedded Contact
-- (added by 007-add-subscription-responsible-contact.sql, part of a discarded earlier draft of
-- this same spec) with a required responsible_person_id FK to a real person row.
ALTER TABLE subscription ADD COLUMN responsible_person_id UUID REFERENCES person(id);

-- Resolve every existing subscription's embedded contact (real or the 008 placeholder) into a
-- Person row, deduping by email exactly the way PersonService.findOrCreatePerson does at
-- request time — two subscriptions sharing the placeholder unknown@test.co.za, or any other
-- repeated email, collapse into one Person, not one each.
INSERT INTO person (id, first_name, last_name, email, phone)
SELECT gen_random_uuid(),
       min(s.responsible_contact_first_name),
       min(s.responsible_contact_last_name),
       lower(s.responsible_contact_email),
       min(s.responsible_contact_phone)
FROM subscription s
WHERE NOT EXISTS (
    SELECT 1 FROM person p WHERE lower(p.email) = lower(s.responsible_contact_email)
)
GROUP BY lower(s.responsible_contact_email);

UPDATE subscription s
SET responsible_person_id = p.id
FROM person p
WHERE lower(p.email) = lower(s.responsible_contact_email);

ALTER TABLE subscription ALTER COLUMN responsible_person_id SET NOT NULL;

ALTER TABLE subscription
    DROP COLUMN responsible_contact_first_name,
    DROP COLUMN responsible_contact_last_name,
    DROP COLUMN responsible_contact_email,
    DROP COLUMN responsible_contact_phone;
