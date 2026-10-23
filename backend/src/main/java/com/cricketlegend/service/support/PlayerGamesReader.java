package com.cricketlegend.service.support;

import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.PlayerMatchView;
import com.cricketlegend.repository.PlayerStatsFactsRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * docs/specs/088: reads the three batched sets behind the Players list's games columns (counted result appearances,
 * selections for started matches, matches with a published result) and hands them to {@link PlayerGamesCounter}. Three
 * statements per scope whatever the number of players.
 */
@Component
public class PlayerGamesReader {

    /** The never-empty section list the shared appearance query requires when no section restriction applies. */
    private static final List<UUID> NO_SECTION_TEAMS = List.of(new UUID(0, 0));

    private final PlayerStatsFactsRepository factsRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;

    public PlayerGamesReader(
            PlayerStatsFactsRepository factsRepository, MatchSidePlayerRepository matchSidePlayerRepository) {
        this.factsRepository = factsRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
    }

    /** Games per player profile for the club; {@code seasonId} null means all seasons. A player with none is absent. */
    public Map<UUID, Long> games(UUID clubId, UUID seasonId, Instant now) {
        List<PlayerMatchView> results = factsRepository.countedPlayerMatches(
                clubId, null, seasonId, null, null, null, false, NO_SECTION_TEAMS);
        List<PlayerMatchView> selections = seasonId == null
                ? matchSidePlayerRepository.findSelectionsForStartedMatches(clubId, now)
                : matchSidePlayerRepository.findSelectionsForStartedMatchesInSeason(clubId, seasonId, now);
        return PlayerGamesCounter.count(
                results.stream().map(PlayerGamesReader::pair).toList(),
                selections.stream().map(PlayerGamesReader::pair).toList(),
                new HashSet<>(factsRepository.publishedResultMatchIds(clubId, seasonId)));
    }

    private static PlayerGamesCounter.PlayerMatch pair(PlayerMatchView view) {
        return new PlayerGamesCounter.PlayerMatch(view.getPlayerProfileId(), view.getMatchId());
    }
}
