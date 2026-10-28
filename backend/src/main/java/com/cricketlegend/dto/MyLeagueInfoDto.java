package com.cricketlegend.dto;

import com.cricketlegend.domain.LeagueFormat;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/123: the league's public profile for the Player Hub. Deliberately no contacts, phone, email, active flag,
 * audit fields or club id (Decision 3).
 */
public record MyLeagueInfoDto(
        UUID id,
        String name,
        String logoUrl,
        Integer minAge,
        Integer maxAge,
        Integer ageCutoffDay,
        Integer ageCutoffMonth,
        LeagueFormat format,
        String website,
        List<SocialLinkDto> socialLinks) {
}
