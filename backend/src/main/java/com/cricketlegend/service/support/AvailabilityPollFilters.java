package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Builds and feeds {@link AvailabilityPollFilter} (docs/specs/083-availability-filters-and-toolbars.md):
 * validates the chosen ids (404 for another club's league or team, access check for the section and
 * the team's section, like the poll lists and the player grid) and batch-loads the matches of group
 * poll windows. Shared by the summary counters and, later, the poll list services.
 */
@Component
public class AvailabilityPollFilters {

    private final AccessService accessService;
    private final LeagueRepository leagueRepository;
    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;

    public AvailabilityPollFilters(
            AccessService accessService,
            LeagueRepository leagueRepository,
            TeamRepository teamRepository,
            MatchRepository matchRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityWindowMatchRepository windowMatchRepository) {
        this.accessService = accessService;
        this.leagueRepository = leagueRepository;
        this.teamRepository = teamRepository;
        this.matchRepository = matchRepository;
        this.windowRepository = windowRepository;
        this.windowMatchRepository = windowMatchRepository;
    }

    /**
     * Validates the ids against {@code clubId} and the caller, then returns the filter. The section
     * narrowing is the section plus descendants intersected with {@code accessible} ({@code
     * Optional.empty()} = unrestricted).
     */
    public AvailabilityPollFilter resolve(
            Authentication authentication,
            UUID clubId,
            Optional<Set<UUID>> accessible,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed) {
        if (leagueId != null) {
            leagueRepository
                    .findById(leagueId)
                    .filter(league -> clubId.equals(league.getClubId()))
                    .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        }
        if (teamId != null) {
            Team team = teamRepository
                    .findById(teamId)
                    .filter(candidate -> clubId.equals(candidate.getClubId()))
                    .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
            accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        }
        Set<UUID> sectionIds = null;
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            sectionIds = new HashSet<>(accessService.sectionAndDescendantIds(clubId, sectionId));
            if (accessible.isPresent()) {
                sectionIds.retainAll(accessible.get());
            }
        }
        return new AvailabilityPollFilter(leagueId, sectionIds, teamId, type, includeClosed);
    }

    /** The active matches in the windows of each round, from three batched queries; rounds without slots are absent. */
    public Map<UUID, List<Match>> slotMatchesByRoundId(Collection<UUID> roundIds) {
        if (roundIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, UUID> roundIdByWindowId = new HashMap<>();
        for (SectionAvailabilityWindow window : windowRepository.findByRoundIdIn(roundIds)) {
            roundIdByWindowId.put(window.getId(), window.getRoundId());
        }
        if (roundIdByWindowId.isEmpty()) {
            return Map.of();
        }
        List<SectionAvailabilityWindowMatch> links = windowMatchRepository.findByWindowIdIn(roundIdByWindowId.keySet());
        if (links.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Match> matchesById = matchRepository
                .findAllById(links.stream().map(SectionAvailabilityWindowMatch::getMatchId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Match::getId, Function.identity()));
        Map<UUID, List<Match>> result = new HashMap<>();
        for (SectionAvailabilityWindowMatch link : links) {
            Match match = matchesById.get(link.getMatchId());
            if (match != null && match.isActive()) { // a deactivated match never satisfies a league/team narrowing
                result.computeIfAbsent(roundIdByWindowId.get(link.getWindowId()), key -> new ArrayList<>()).add(match);
            }
        }
        return result;
    }
}
