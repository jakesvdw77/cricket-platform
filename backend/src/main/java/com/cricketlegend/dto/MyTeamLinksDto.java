package com.cricketlegend.dto;

import java.util.List;

/** The social links of one team a held player belongs to (docs/specs/157, Hub Social Media): https only, never empty. */
public record MyTeamLinksDto(String teamName, List<MyClubSocialLinkDto> social) {
}
