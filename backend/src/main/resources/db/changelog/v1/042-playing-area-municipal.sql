-- docs/specs/099-fields-directory.md: a field's Type gains MUNICIPAL (council or municipal grounds).
ALTER TABLE playing_area DROP CONSTRAINT ck_playing_area_category;
ALTER TABLE playing_area ADD CONSTRAINT ck_playing_area_category
    CHECK (category IN ('SCHOOL', 'CLUB', 'ACADEMY', 'MUNICIPAL', 'PROVINCIAL'));
