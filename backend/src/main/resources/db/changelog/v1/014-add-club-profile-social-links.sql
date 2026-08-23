CREATE TABLE club_profile_social_link (
    club_id  UUID NOT NULL REFERENCES club_profile(club_id),
    platform VARCHAR(64) NOT NULL,
    url      VARCHAR(512) NOT NULL,
    PRIMARY KEY (club_id, platform)
);
