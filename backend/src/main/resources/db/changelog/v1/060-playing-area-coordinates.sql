-- docs/specs/133: stored coordinates and an optional access point (entrance or parking) on a field. All nullable; a pair is both-or-neither.
ALTER TABLE playing_area ADD COLUMN latitude NUMERIC(9,6) NULL;
ALTER TABLE playing_area ADD COLUMN longitude NUMERIC(9,6) NULL;
ALTER TABLE playing_area ADD COLUMN access_latitude NUMERIC(9,6) NULL;
ALTER TABLE playing_area ADD COLUMN access_longitude NUMERIC(9,6) NULL;
ALTER TABLE playing_area ADD COLUMN access_note VARCHAR(200) NULL;
ALTER TABLE playing_area ADD CONSTRAINT ck_playing_area_coordinates CHECK (
    (latitude IS NULL) = (longitude IS NULL)
    AND (latitude IS NULL OR latitude BETWEEN -90 AND 90)
    AND (longitude IS NULL OR longitude BETWEEN -180 AND 180));
ALTER TABLE playing_area ADD CONSTRAINT ck_playing_area_access_coordinates CHECK (
    (access_latitude IS NULL) = (access_longitude IS NULL)
    AND (access_latitude IS NULL OR access_latitude BETWEEN -90 AND 90)
    AND (access_longitude IS NULL OR access_longitude BETWEEN -180 AND 180));
ALTER TABLE playing_area ADD CONSTRAINT ck_playing_area_access_note CHECK (
    access_note IS NULL OR access_latitude IS NOT NULL);
