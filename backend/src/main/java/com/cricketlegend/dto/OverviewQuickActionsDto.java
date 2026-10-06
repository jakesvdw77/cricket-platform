package com.cricketlegend.dto;

/**
 * Which overview shortcuts the caller may use, computed with the same {@code AccessService} rule the
 * matching endpoints are guarded by (match create, squad and group poll create and player create are
 * all {@code canAccessClub}; Communication is a placeholder feature, so messageSquad uses the same).
 */
public record OverviewQuickActionsDto(
        boolean createMatch, boolean createPoll, boolean addPlayer, boolean messageSquad) {
}
