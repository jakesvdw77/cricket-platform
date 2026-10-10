package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSpecifications;
import com.cricketlegend.repository.TeamRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Which of a club's matches a manager's list-style read covers, with the same section scope and
 * filter semantics as {@code PlayerAvailabilityServiceImpl} (docs/specs/068) and {@code
 * GET .../availability-polls/open} (docs/specs/035): the caller's accessible sections, narrowed to
 * a validated {@code sectionId}'s closure, a {@code teamId} (404 for another club's, 403 for one
 * out of scope) defining its own section as the scope. Used by the team-selection overview
 * (docs/specs/093); {@code PlayerAvailabilityServiceImpl} keeps its own copy until it is moved here.
 */
@Component
public class ClubMatchScope {

    /**
     * The resolved scope: {@code sectionIds} null means unrestricted; {@code empty} means nothing
     * can match (a team outside the chosen section, or no accessible section).
     */
    public record Scope(Set<UUID> sectionIds, UUID teamId, boolean empty) {
    }

    private final AccessService accessService;
    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;

    public ClubMatchScope(AccessService accessService, TeamRepository teamRepository, MatchRepository matchRepository) {
        this.accessService = accessService;
        this.teamRepository = teamRepository;
        this.matchRepository = matchRepository;
    }

    public Scope resolve(Authentication authentication, UUID clubId, UUID sectionId, UUID teamId) {
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        Set<UUID> narrowTo = null;
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            narrowTo = accessService.sectionAndDescendantIds(clubId, sectionId);
        }
        Set<UUID> sections = narrowTo;
        if (accessible.isPresent()) {
            sections = new HashSet<>(accessible.get());
            if (narrowTo != null) {
                sections.retainAll(narrowTo);
            }
        }
        if (teamId != null) {
            Team team = teamRepository
                    .findById(teamId)
                    .filter(candidate -> clubId.equals(candidate.getClubId()))
                    .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
            accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
            boolean outside = sectionId != null && !sections.contains(team.getSectionId());
            return new Scope(Set.of(team.getSectionId()), teamId, outside);
        }
        return new Scope(sections, null, sections != null && sections.isEmpty());
    }

    /**
     * Active matches in scope, soonest first (without {@code includePast} every match is upcoming),
     * or with it the LATEST {@code limit} returned ascending. One extra row tells whether the cap cut
     * anything: the result holds at most {@code limit + 1} matches, the caller trims.
     */
    public List<Match> find(
            UUID clubId, Scope scope, UUID seasonId, UUID leagueId, boolean includePast, int limit) {
        Specification<Match> spec = Specification.where(MatchSpecifications.clubId(clubId))
                .and(MatchSpecifications.active());
        if (scope.sectionIds() != null) {
            spec = spec.and(MatchSpecifications.sectionIn(scope.sectionIds()));
        }
        if (leagueId != null) {
            spec = spec.and(MatchSpecifications.leagueIdEquals(leagueId));
        }
        if (seasonId != null) {
            spec = spec.and(MatchSpecifications.seasonIdEquals(seasonId));
        }
        if (scope.teamId() != null) {
            spec = spec.and(MatchSpecifications.teamIdEquals(scope.teamId()));
        }
        if (!includePast) {
            spec = spec.and(MatchSpecifications.matchDateOnOrAfter(ServerClock.startOfToday()));
        }
        Sort sort = includePast
                ? Sort.by(Sort.Order.desc("matchDate"), Sort.Order.desc("id"))
                : Sort.by(Sort.Order.asc("matchDate"), Sort.Order.asc("id"));
        return matchRepository.findAll(spec, PageRequest.of(0, limit + 1, sort)).getContent();
    }

    /** This club's teams in the match that lie in scope (and are the chosen team when one is chosen), home first. */
    public List<Team> ownTeams(Match match, UUID clubId, Scope scope, Map<UUID, Team> teamsById) {
        List<Team> own = new ArrayList<>();
        for (UUID candidateId : new UUID[] {match.getHomeTeamId(), match.getAwayTeamId()}) {
            Team team = candidateId == null ? null : teamsById.get(candidateId);
            if (team != null
                    && clubId.equals(team.getClubId())
                    && (scope.sectionIds() == null || scope.sectionIds().contains(team.getSectionId()))
                    && (scope.teamId() == null || scope.teamId().equals(team.getId()))) {
                own.add(team);
            }
        }
        return own;
    }
}
