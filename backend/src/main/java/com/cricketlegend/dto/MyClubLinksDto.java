package com.cricketlegend.dto;

import java.util.List;

/** docs/specs/148: the club website and social links, https only. */
public record MyClubLinksDto(String website, List<MyClubSocialLinkDto> social) {
}
