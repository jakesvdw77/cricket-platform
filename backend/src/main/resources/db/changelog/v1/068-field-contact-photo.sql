-- docs/specs/151-server-test-round-one.md slice C: a contact person, a contact number and a photo on a field.
ALTER TABLE playing_area ADD COLUMN contact_name  VARCHAR(100);
ALTER TABLE playing_area ADD COLUMN contact_phone VARCHAR(30);
ALTER TABLE playing_area ADD COLUMN photo_url     VARCHAR(500);
