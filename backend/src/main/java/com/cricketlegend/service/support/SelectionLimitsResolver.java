package com.cricketlegend.service.support;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The one place that answers "how many players may this match's selection hold?"
 * (docs/specs/076-team-selection.md section 4). No league (a friendly): 11 places and a 12th man.
 * A league: {@code min(maxPlayingXiSize, 12)} places, and a 12th man only when that league's
 * playing conditions for the match's season allow substitutions and the places are fewer than 12.
 * {@code maxSelected} is places plus the 12th man place, so never above 12. When the places move
 * onto the playing conditions (draft 055) only this class changes.
 */
@Component
public class SelectionLimitsResolver {

    static final int MAX_PLACES = 12;
    static final int FRIENDLY_PLACES = 11;

    /** A league and the season a match is played in: the key the conditions are looked up by. */
    public record LeagueSeason(UUID leagueId, UUID seasonId) {
    }

    private final LeagueRepository leagueRepository;
    private final LeaguePlayingConditionsRepository conditionsRepository;

    public SelectionLimitsResolver(
            LeagueRepository leagueRepository, LeaguePlayingConditionsRepository conditionsRepository) {
        this.leagueRepository = leagueRepository;
        this.conditionsRepository = conditionsRepository;
    }

    public SelectionLimitsDto limits(Match match) {
        if (match.getLeagueId() == null) {
            return friendly();
        }
        LeagueSeason key = new LeagueSeason(match.getLeagueId(), match.getSeasonId());
        SelectionLimitsDto limits = limitsFor(Set.of(key)).get(key);
        if (limits == null) {
            throw new NotFoundException("League not found: " + match.getLeagueId());
        }
        return limits;
    }

    /**
     * Batch form: one leagues query and one conditions query for any number of pairs (the match
     * list page). A pair whose league cannot be found is absent from the result.
     */
    public Map<LeagueSeason, SelectionLimitsDto> limitsFor(Set<LeagueSeason> pairs) {
        Map<LeagueSeason, SelectionLimitsDto> result = new HashMap<>();
        if (pairs.isEmpty()) {
            return result;
        }
        Set<UUID> leagueIds = new HashSet<>();
        Set<UUID> seasonIds = new HashSet<>();
        for (LeagueSeason pair : pairs) {
            leagueIds.add(pair.leagueId());
            seasonIds.add(pair.seasonId());
        }
        Map<UUID, League> leagues = leagueRepository.findAllById(leagueIds).stream()
                .collect(Collectors.toMap(League::getId, league -> league));
        Map<LeagueSeason, LeaguePlayingConditions> conditions = conditionsRepository
                .findByLeagueIdInAndSeasonIdIn(leagueIds, seasonIds).stream()
                .collect(Collectors.toMap(
                        c -> new LeagueSeason(c.getLeagueId(), c.getSeasonId()), c -> c, (a, b) -> a));
        for (LeagueSeason pair : pairs) {
            League league = leagues.get(pair.leagueId());
            if (league == null) {
                continue;
            }
            LeaguePlayingConditions pairConditions = conditions.get(pair);
            result.put(pair, forLeague(league, pairConditions != null && pairConditions.isAllowSubstitutions()));
        }
        return result;
    }

    private SelectionLimitsDto forLeague(League league, boolean allowSubstitutions) {
        int places = Math.min(league.getMaxPlayingXiSize(), MAX_PLACES);
        boolean twelfthManAllowed = allowSubstitutions && places < MAX_PLACES;
        return new SelectionLimitsDto(places, twelfthManAllowed, places + (twelfthManAllowed ? 1 : 0));
    }

    private SelectionLimitsDto friendly() {
        return new SelectionLimitsDto(FRIENDLY_PLACES, true, FRIENDLY_PLACES + 1);
    }
}
