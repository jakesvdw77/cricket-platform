package com.cricketlegend.service.support;

import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * docs/specs/103-player-stats.md: the one place a statistics read checks tenancy and section scope, shared by the player
 * statistics and leaderboard services. An unknown or other-club season, league, team or section is a {@link
 * NotFoundException}; a section or team outside a section-scoped caller's reach is refused with 403 by {@link
 * ClubMatchScope}; a section-scoped caller is narrowed to the teams of their accessible sections (intersected with any
 * section filter, descendant sections included). The {@link StatsScope} it returns carries no caller information.
 */
@Component
public class StatsScopeResolver {

    /** Native {@code IN} lists may not be empty; this id matches no team. */
    private static final UUID NO_TEAM = new UUID(0L, 0L);

    /** The scope, and whether the caller's reach leaves nothing to read (so no query is needed). */
    public record Resolved(StatsScope scope, boolean nothingInReach) {
    }

    private final SeasonRepository seasonRepository;
    private final LeagueRepository leagueRepository;
    private final TeamRepository teamRepository;
    private final ClubMatchScope clubMatchScope;

    public StatsScopeResolver(
            SeasonRepository seasonRepository,
            LeagueRepository leagueRepository,
            TeamRepository teamRepository,
            ClubMatchScope clubMatchScope) {
        this.seasonRepository = seasonRepository;
        this.leagueRepository = leagueRepository;
        this.teamRepository = teamRepository;
        this.clubMatchScope = clubMatchScope;
    }

    public Resolved resolve(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            StatsScope.Competition competition) {
        if (seasonId != null) {
            seasonRepository
                    .findById(seasonId)
                    .filter(season -> clubId.equals(season.getClubId()))
                    .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        }
        if (leagueId != null) {
            leagueRepository
                    .findById(leagueId)
                    .filter(league -> clubId.equals(league.getClubId()))
                    .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        }
        // 404 for another club's section or team, 403 outside a section-scoped caller's reach (ClubMatchScope).
        ClubMatchScope.Scope reach = clubMatchScope.resolve(authentication, clubId, sectionId, teamId);
        Set<UUID> sectionTeamIds = reach.sectionIds() == null ? null : teamIdsInSections(clubId, reach.sectionIds());
        boolean nothingInReach = reach.empty() || (sectionTeamIds != null && sectionTeamIds.isEmpty());
        return new Resolved(
                new StatsScope(clubId, seasonId, leagueId, teamId, sectionTeamIds, competition), nothingInReach);
    }

    /** The {@code sectionTeamIds} query parameter: never empty (a sentinel matching no team when unrestricted). */
    public static List<UUID> sectionTeamParameter(StatsScope scope) {
        return scope.sectionRestricted() && !scope.sectionTeamIds().isEmpty()
                ? List.copyOf(scope.sectionTeamIds())
                : List.of(NO_TEAM);
    }

    /** The {@code competition} query parameter: LEAGUE, FRIENDLY or null for no filter. */
    public static String competitionName(StatsScope scope) {
        return scope.competition() == null ? null : scope.competition().name();
    }

    private Set<UUID> teamIdsInSections(UUID clubId, Set<UUID> sectionIds) {
        Set<UUID> teamIds = new HashSet<>();
        teamRepository.findByClubId(clubId).forEach(team -> {
            if (sectionIds.contains(team.getSectionId())) {
                teamIds.add(team.getId());
            }
        });
        return teamIds;
    }
}
