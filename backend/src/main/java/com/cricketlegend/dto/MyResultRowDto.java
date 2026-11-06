package com.cricketlegend.dto;

import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchAwards;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBatting;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowling;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFielding;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchResult;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchTeam;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/145: one result as the Player Hub shows it: a counted match of the held player (the same row as the manager
 * match list, {@link PlayerMatchRowDto}, so the figures are equal by construction) with the match header words. Carries
 * no result id and no other internal id beyond the match, team and league. {@code result} is from the player's side;
 * {@code homeScore} and {@code awayScore} are the short score texts ("212/6 (40.0)", empty when none) and {@code
 * resultLine} the result in words ("Irene Villagers won by 24 runs").
 */
public record MyResultRowDto(
        UUID matchId,
        Instant matchDate,
        List<PlayerMatchTeam> ourTeams,
        String opponentName,
        boolean derby,
        UUID leagueId,
        String leagueName,
        String competition,
        PlayerMatchResult result,
        String homeName,
        String awayName,
        String homeScore,
        String awayScore,
        String resultLine,
        int ballsPerOver,
        boolean hasBattingCard,
        boolean hasBowlingCard,
        PlayerMatchBatting batting,
        PlayerMatchBowling bowling,
        PlayerMatchFielding fielding,
        PlayerMatchAwards awards) {}
