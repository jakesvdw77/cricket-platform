package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.AvailabilitySummaryPlayerKind;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.dto.AvailabilitySummaryPlayerDto;
import com.cricketlegend.dto.AvailabilitySummaryPlayerDto.PollRef;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.AvailabilitySummaryService;
import com.cricketlegend.service.support.AvailabilityPollFilter;
import com.cricketlegend.service.support.AvailabilityPollFilters;
import com.cricketlegend.service.support.AvailabilitySummaryPlayers;
import com.cricketlegend.service.support.OverviewPolls;
import com.cricketlegend.service.support.OverviewPolls.OpenPoll;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/081-plain-page-header-and-counters.md. Reads the very polls the manager overview
 * does, through {@link OverviewPolls} and the same {@link AccessService#accessibleSectionIds} scope,
 * so with no filter its polls are the overview's by construction. The optional filters of
 * docs/specs/083-availability-filters-and-toolbars.md come from {@link AvailabilityPollFilters}.
 * {@code playersStillToAnswer} counts distinct players. An open poll is closing soon when its close
 * time is after now and at most 48 hours away.
 */
@Service
public class AvailabilitySummaryServiceImpl implements AvailabilitySummaryService {

    /** Largest page the players list serves, whatever size the caller asks for. */
    static final int MAX_PAGE_SIZE = 100;

    private final OverviewPolls overviewPolls;
    private final AccessService accessService;
    private final AvailabilityPollFilters pollFilters;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final Clock clock;

    public AvailabilitySummaryServiceImpl(
            OverviewPolls overviewPolls,
            AccessService accessService,
            AvailabilityPollFilters pollFilters,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            Clock clock) {
        this.overviewPolls = overviewPolls;
        this.accessService = accessService;
        this.pollFilters = pollFilters;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public AvailabilitySummaryDto summary(
            Authentication authentication,
            UUID clubId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            UUID seasonId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed) {
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        // Validate the filter ids first so a bad id is a 404/403 even for a caller with no sections.
        AvailabilityPollFilter filter = pollFilters.resolve(
                authentication, clubId, accessible, leagueId, sectionId, teamId, type, includeClosed, seasonId);
        if (accessible.isPresent() && accessible.get().isEmpty()) {
            return new AvailabilitySummaryDto(0, 0, 0, 0, 0);
        }
        List<OpenPoll> polls = overviewPolls.pollsWithPlayers(clubId, accessible, filter);
        Instant now = clock.instant();
        AvailabilitySummaryPlayers players = AvailabilitySummaryPlayers.of(polls);
        int closingSoon = (int) polls.stream().filter(shown -> AvailabilitySummaryPlayers.isClosingSoon(shown, now)).count();
        return new AvailabilitySummaryDto(
                polls.size(),
                players.responded().size(),
                players.audience().size(),
                players.stillToAnswer().size(),
                closingSoon);
    }

    /**
     * Pages in memory on purpose (docs/plans/084-clickable-counters.md, decision 3): the list is
     * derived from the poll aggregation, whose size is bounded by the club's open polls (not capped)
     * and at most {@code CLOSED_POLLS_LIMIT} closed polls per kind, processed in one pass over sets
     * already loaded in a fixed number of queries. An exception to the backend pagination rule that
     * must not be copied for a genuinely unbounded list; see {@link AvailabilitySummaryService#players}.
     */
    @Override
    @Transactional(readOnly = true)
    public Page<AvailabilitySummaryPlayerDto> players(
            Authentication authentication,
            UUID clubId,
            AvailabilitySummaryPlayerKind kind,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            UUID seasonId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed,
            boolean closingSoon,
            String search,
            Pageable pageable) {
        Pageable page = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), MAX_PAGE_SIZE));
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        AvailabilityPollFilter filter = pollFilters.resolve(
                authentication, clubId, accessible, leagueId, sectionId, teamId, type, includeClosed, seasonId);
        if (accessible.isPresent() && accessible.get().isEmpty()) {
            return new PageImpl<>(List.of(), page, 0);
        }
        Instant now = clock.instant();
        List<OpenPoll> polls = overviewPolls.pollsWithPlayers(clubId, accessible, filter).stream()
                .filter(shown -> !closingSoon || AvailabilitySummaryPlayers.isClosingSoon(shown, now))
                .toList();
        // The counter's own sets decide who is in: the totals equal the counters by construction.
        AvailabilitySummaryPlayers totals = AvailabilitySummaryPlayers.of(polls);
        Set<UUID> inList = kind == AvailabilitySummaryPlayerKind.RESPONDED ? totals.responded() : totals.stillToAnswer();
        Map<UUID, List<PollRef>> pollsByPlayer = new HashMap<>();
        for (OpenPoll shown : polls) {
            PollRef ref = new PollRef(shown.poll().kind(), shown.poll().id(), shown.poll().matchId(), shown.poll().title());
            for (UUID player : kind == AvailabilitySummaryPlayerKind.RESPONDED ? shown.responded() : shown.awaiting()) {
                if (inList.contains(player)) {
                    pollsByPlayer.computeIfAbsent(player, key -> new ArrayList<>()).add(ref);
                }
            }
        }
        Map<UUID, String> names = displayNames(pollsByPlayer.keySet());
        String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<AvailabilitySummaryPlayerDto> matching = pollsByPlayer.entrySet().stream()
                .map(entry -> new AvailabilitySummaryPlayerDto(
                        entry.getKey(), names.getOrDefault(entry.getKey(), ""), entry.getValue()))
                .filter(player -> needle.isEmpty() || player.displayName().toLowerCase(Locale.ROOT).contains(needle))
                .sorted(Comparator.comparingInt((AvailabilitySummaryPlayerDto player) -> player.polls().size())
                        .reversed()
                        .thenComparing(AvailabilitySummaryPlayerDto::displayName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(AvailabilitySummaryPlayerDto::playerProfileId))
                .toList();
        int from = (int) Math.min(page.getOffset(), matching.size());
        int to = Math.min(from + page.getPageSize(), matching.size());
        return new PageImpl<>(matching.subList(from, to), page, matching.size());
    }

    /** "First Last" per player, from two batched lookups (profile, then person). */
    private Map<UUID, String> displayNames(Set<UUID> playerProfileIds) {
        if (playerProfileIds.isEmpty()) {
            return Map.of();
        }
        List<PlayerProfile> profiles = playerProfileRepository.findAllById(playerProfileIds);
        Map<UUID, Person> personsById = new HashMap<>();
        personRepository.findAllById(profiles.stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet()))
                .forEach(person -> personsById.put(person.getId(), person));
        Map<UUID, String> result = new HashMap<>();
        for (PlayerProfile profile : profiles) {
            Person person = personsById.get(profile.getPersonId());
            if (person != null) {
                result.put(profile.getId(), ((person.getFirstName() == null ? "" : person.getFirstName()) + " "
                                + (person.getLastName() == null ? "" : person.getLastName()))
                        .trim());
            }
        }
        return result;
    }
}
