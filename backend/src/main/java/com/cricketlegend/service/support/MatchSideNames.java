package com.cricketlegend.service.support;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import java.util.Map;
import java.util.UUID;

/**
 * The display name of a match's home or away side: the real team's name when the side is a team,
 * otherwise the free-text name stored on the match (per {@code Match}'s exactly-one-of-id-or-name
 * invariant). Static and allocation-free so batch callers resolve names from a team map loaded once.
 */
public final class MatchSideNames {

    private MatchSideNames() {}

    public static String home(Match match, Map<UUID, Team> teamsById) {
        return name(match.getHomeTeamId(), match.getHomeTeamName(), teamsById);
    }

    public static String away(Match match, Map<UUID, Team> teamsById) {
        return name(match.getAwayTeamId(), match.getAwayTeamName(), teamsById);
    }

    private static String name(UUID teamId, String freeText, Map<UUID, Team> teamsById) {
        Team team = teamId == null ? null : teamsById.get(teamId);
        return team != null ? team.getName() : freeText;
    }
}
