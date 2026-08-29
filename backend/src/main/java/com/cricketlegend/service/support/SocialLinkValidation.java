package com.cricketlegend.service.support;

import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.exception.ValidationException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Shared {@code socialLinks} validation for any entity embedding a {@code List<SocialLinkDto>}
 * (currently {@code ClubProfile} and {@code Sponsor}) — extracted per docs/standards/backend.md's
 * "shared logic lives in one place" rule after {@code ClubProfileServiceImpl} and {@code
 * SponsorServiceImpl} both needed the identical duplicate-platform check.
 */
public final class SocialLinkValidation {

    private SocialLinkValidation() {}

    /**
     * Rejects a case-sensitive duplicate {@code platform} string within the list, checked before
     * any DB write. The DB's composite PK on the owning entity's social-link table (e.g. {@code
     * club_profile_social_link}, {@code sponsor_social_link}) is a backstop, not the primary guard.
     */
    public static void requireNoDuplicatePlatform(List<SocialLinkDto> dtos) {
        if (dtos == null) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (SocialLinkDto dto : dtos) {
            if (!seen.add(dto.platform())) {
                throw new ValidationException("Duplicate social media platform: " + dto.platform());
            }
        }
    }
}
