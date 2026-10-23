package com.cricketlegend.dto;

/** An agent of a player as the main agent sees them (docs/specs/119): name and masked email only. */
public record MyPlayerAgentDto(String name, String maskedEmail, boolean main) {
}
