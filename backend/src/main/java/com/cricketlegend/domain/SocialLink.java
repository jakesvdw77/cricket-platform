package com.cricketlegend.domain;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A single social media / external link for a {@link ClubProfile} — a free-text {@code platform}
 * label (not an enum; e.g. {@code "facebook"} or a club-typed custom label like
 * {@code "Discord"}) paired with a {@code url}. No independent identity or lifecycle, so it's
 * mapped via {@code ClubProfile.socialLinks}'s {@code @ElementCollection}, not a full entity —
 * see docs/specs/022-club-social-media.md.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialLink {

    private String platform;

    private String url;
}
