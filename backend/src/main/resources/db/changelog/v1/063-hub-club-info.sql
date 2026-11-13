-- docs/specs/148-player-hub-club-info.md: what a club shows its linked accounts on Player Hub Club Info.
ALTER TABLE club_profile ADD COLUMN hub_info_identity           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_contact            BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_links              BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_logos              BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE club_profile ADD COLUMN hub_info_logo_download      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE club_profile ADD COLUMN hub_info_directory          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE club_profile ADD COLUMN hub_info_directory_phone    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE club_profile ADD COLUMN hub_info_directory_email    BOOLEAN NOT NULL DEFAULT false;

-- The directory query: a club's active contacts in name order (no per-contact columns: owner, 2026-11-12).
CREATE INDEX ix_club_contact_hub ON club_contact(club_id, last_name, first_name) WHERE active;
