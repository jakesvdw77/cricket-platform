-- docs/specs/157-photo-gallery.md: the club photo gallery. One row per photo (a medium and a thumbnail file under /media), and a tag row per league, team or player a photo is tagged to.
CREATE TABLE gallery_image (
    id                    UUID         PRIMARY KEY,
    club_id               UUID         NOT NULL,
    uploaded_by_person_id UUID         NOT NULL,
    uploaded_at           TIMESTAMPTZ  NOT NULL,
    caption               VARCHAR(200),
    medium_url            VARCHAR(255) NOT NULL,
    thumb_url             VARCHAR(255) NOT NULL,
    status                VARCHAR(20)  NOT NULL DEFAULT 'PUBLISHED'
);
CREATE INDEX ix_gallery_image_club_time ON gallery_image (club_id, status, uploaded_at DESC);
CREATE INDEX ix_gallery_image_uploader_time ON gallery_image (uploaded_by_person_id, uploaded_at DESC);

CREATE TABLE gallery_image_tag (
    id        UUID        PRIMARY KEY,
    image_id  UUID        NOT NULL REFERENCES gallery_image (id) ON DELETE CASCADE,
    tag_type  VARCHAR(10) NOT NULL,
    tag_id    UUID        NOT NULL,
    CONSTRAINT ux_gallery_image_tag UNIQUE (image_id, tag_type, tag_id)
);
CREATE INDEX ix_gallery_image_tag_tag ON gallery_image_tag (tag_type, tag_id);
