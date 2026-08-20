ALTER TABLE subscription
    ADD COLUMN responsible_contact_first_name VARCHAR(255),
    ADD COLUMN responsible_contact_last_name  VARCHAR(255),
    ADD COLUMN responsible_contact_email      VARCHAR(255),
    ADD COLUMN responsible_contact_phone      VARCHAR(32);
