package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Reads a player's answer on the poll covering a match for one team
 * (docs/specs/076-team-selection.md section 7), in one batched read per call. GROUP coverage reads
 * the window's {@code SectionAvailabilityResponse} rows (one answer per date and Morning/Afternoon
 * window); SQUAD coverage reads the poll's {@code PlayerAvailability} rows (a null status is no
 * answer); NONE means nobody was polled. An unanswered player inside the poll's audience is
 * NO_RESPONSE, outside it NOT_POLLED. Only the poll covering <em>this</em> match is consulted.
 */
@Component
public class SelectionAvailabilityResolver {

    private final MatchPollCoverageService coverageService;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityResponseRepository windowResponseRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final AccessService accessService;

    public SelectionAvailabilityResolver(
            MatchPollCoverageService coverageService,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityResponseRepository windowResponseRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            PlayerSectionRepository playerSectionRepository,
            PlayerProfileRepository playerProfileRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            AccessService accessService) {
        this.coverageService = coverageService;
        this.windowRepository = windowRepository;
        this.windowResponseRepository = windowResponseRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.accessService = accessService;
    }

    /** The poll covering {@code matchId} as seen by {@code teamId}'s side (group wins over squad). */
    public MatchPollCoverageService.Coverage coverage(UUID matchId, UUID teamId) {
        return coverageService.resolve(matchId, teamId);
    }

    /** Everyone whose answer on the covering GROUP poll's window is Available (empty for any other kind). */
    public Set<UUID> availableOnGroupPoll(MatchPollCoverageService.Coverage coverage) {
        if (coverage.kind() != MatchPollCoverageService.Kind.GROUP) {
            return Set.of();
        }
        return windowResponseRepository.findByWindowId(coverage.windowId()).stream()
                .filter(response -> response.getStatus() == AvailabilityStatus.AVAILABLE)
                .map(SectionAvailabilityResponse::getPlayerProfileId)
                .collect(Collectors.toSet());
    }

    /** The status of every given player; every id is a key. */
    public Map<UUID, SelectionAvailability> statuses(
            Match match, UUID teamId, MatchPollCoverageService.Coverage coverage, Collection<UUID> playerIds) {
        Map<UUID, SelectionAvailability> result = new HashMap<>();
        if (playerIds.isEmpty()) {
            return result;
        }
        Map<UUID, AvailabilityStatus> answers = new HashMap<>();
        Set<UUID> audience = new HashSet<>();
        if (coverage.kind() == MatchPollCoverageService.Kind.GROUP) {
            windowRepository.findById(coverage.windowId()).ifPresent(window -> {
                windowResponseRepository.findByWindowId(window.getId())
                        .forEach(response -> answers.put(response.getPlayerProfileId(), response.getStatus()));
                audience.addAll(groupAudience(window, playerIds));
            });
        } else if (coverage.kind() == MatchPollCoverageService.Kind.SQUAD) {
            for (PlayerAvailability row : playerAvailabilityRepository.findByPollId(coverage.pollId())) {
                if (row.getStatus() != null) {
                    answers.put(row.getPlayerProfileId(), row.getStatus());
                }
            }
            teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, match.getSeasonId()).stream()
                    .map(TeamSquadMember::getPlayerProfileId)
                    .forEach(audience::add);
        }
        boolean polled = coverage.kind() != MatchPollCoverageService.Kind.NONE;
        for (UUID playerId : playerIds) {
            result.put(playerId, statusOf(polled, answers.get(playerId), audience.contains(playerId)));
        }
        return result;
    }

    private SelectionAvailability statusOf(boolean polled, AvailabilityStatus answer, boolean inAudience) {
        if (!polled) {
            return SelectionAvailability.NOT_POLLED;
        }
        if (answer != null) {
            return switch (answer) {
                case AVAILABLE -> SelectionAvailability.AVAILABLE;
                case UNSURE -> SelectionAvailability.UNSURE;
                case UNAVAILABLE -> SelectionAvailability.UNAVAILABLE;
            };
        }
        return inAudience ? SelectionAvailability.NO_RESPONSE : SelectionAvailability.NOT_POLLED;
    }

    /** The given players who are in the window's audience: active and tagged to its section or a descendant. */
    private Set<UUID> groupAudience(SectionAvailabilityWindow window, Collection<UUID> playerIds) {
        Set<UUID> sectionIds = accessService.sectionAndDescendantIds(window.getClubId(), window.getSectionId());
        Set<UUID> tagged = playerSectionRepository.findBySectionIdIn(sectionIds).stream()
                .map(PlayerSection::getPlayerProfileId)
                .collect(Collectors.toSet());
        return playerProfileRepository.findAllById(new HashSet<>(playerIds)).stream()
                .filter(PlayerProfile::isActive)
                .map(PlayerProfile::getId)
                .filter(tagged::contains)
                .collect(Collectors.toSet());
    }
}
