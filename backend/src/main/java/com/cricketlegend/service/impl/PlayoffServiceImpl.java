package com.cricketlegend.service.impl;

import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.CreatePlayoffsRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.PlayoffGameRequest;
import com.cricketlegend.dto.PlayoffSideRequest;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.PlayoffService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

/**
 * docs/specs/155-playoff-and-knockout-fixtures.md. A round is turned into ordinary {@link CreateMatchRequest}s and handed to
 * {@link MatchService#createBatch}, so every rule of a normal match (sides, league and season, season dates, access,
 * scheduling) applies unchanged. The preview runs the same call and rolls the transaction back, so what it reports is exactly
 * what the confirm call would create and nothing is written before the manager confirms.
 */
@Service
public class PlayoffServiceImpl implements PlayoffService {

    private final MatchService matchService;

    public PlayoffServiceImpl(MatchService matchService) {
        this.matchService = matchService;
    }

    @Override
    @Transactional
    public List<MatchDto> preview(
            Authentication authentication, UUID clubId, UUID leagueId, UUID seasonId, CreatePlayoffsRequest request) {
        List<MatchDto> games = matchService.createBatch(authentication, clubId, toMatchRequests(leagueId, seasonId, request));
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        return games;
    }

    @Override
    @Transactional
    public List<MatchDto> create(
            Authentication authentication, UUID clubId, UUID leagueId, UUID seasonId, CreatePlayoffsRequest request) {
        return matchService.createBatch(authentication, clubId, toMatchRequests(leagueId, seasonId, request));
    }

    private List<CreateMatchRequest> toMatchRequests(UUID leagueId, UUID seasonId, CreatePlayoffsRequest request) {
        String stage = request.stage().trim();
        return request.games().stream().map(game -> toMatchRequest(leagueId, seasonId, stage, game, request)).toList();
    }

    private CreateMatchRequest toMatchRequest(
            UUID leagueId, UUID seasonId, String stage, PlayoffGameRequest game, CreatePlayoffsRequest request) {
        Side home = side(game.home(), "home");
        Side away = side(game.away(), "away");
        String gameStage = game.stage() != null && !game.stage().isBlank() ? game.stage().trim() : stage;
        return new CreateMatchRequest(
                home.teamId(), home.name(), away.teamId(), away.name(), null, null, leagueId, seasonId,
                game.matchDate(), game.venue(), home.leagueTeamId(), away.leagueTeamId(), null, null,
                game.playingAreaId(), request.acknowledgedWarnings(), gameStage, game.label(), home.placeholder(),
                away.placeholder());
    }

    private record Side(UUID teamId, UUID leagueTeamId, String name, boolean placeholder) {
    }

    private Side side(PlayoffSideRequest side, String which) {
        boolean hasText = side.placeholder() != null && !side.placeholder().isBlank();
        int kinds = (hasText ? 1 : 0) + (side.teamId() != null ? 1 : 0) + (side.leagueTeamId() != null ? 1 : 0);
        if (kinds != 1) {
            throw new ValidationException(
                    "The " + which + " side must be exactly one of a TBC text, a team or a league team");
        }
        return hasText
                ? new Side(null, null, side.placeholder().trim(), true)
                : new Side(side.teamId(), side.leagueTeamId(), null, false);
    }
}
