package com.cricketlegend.dto;

import com.cricketlegend.domain.PlayingRole;

/** docs/specs/135: one player of an announced XI; the name is already initials where the junior rule applies. */
public record MyMatchPlayerDto(String name, PlayingRole role, boolean captain, boolean keeper, boolean twelfth) {}
