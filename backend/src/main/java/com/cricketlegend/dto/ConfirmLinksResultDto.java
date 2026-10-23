package com.cricketlegend.dto;

import java.util.List;

/** The players that are now linked to the caller as main agent. */
public record ConfirmLinksResultDto(List<PlayerMatchDto> linked) {}
