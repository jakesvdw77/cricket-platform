package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.AvailabilitySummaryPlayerKind;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.AvailabilitySummaryPlayerDto;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.mockito.ArgumentMatchers;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.dto.OverviewPollDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.service.impl.AvailabilitySummaryServiceImpl;
import com.cricketlegend.service.support.AvailabilityPollFilter;
import com.cricketlegend.service.support.AvailabilityPollFilters;
import com.cricketlegend.service.support.OverviewPolls;
import com.cricketlegend.service.support.OverviewPolls.OpenPoll;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * Unit tests for AvailabilitySummaryServiceImpl (docs/specs/081-plain-page-header-and-counters.md):
 * the five counters, distinct-player counting across polls, the 48-hour closing-soon window and
 * scoping. Which polls are in scope is OverviewPolls' job (OverviewPollsTest and the integration
 * tests); here the scope is checked as what is passed to it.
 */
@ExtendWith(MockitoExtension.class)
class AvailabilitySummaryServiceImplTest {

    private static final UUID CLUB_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2031-06-01T10:00:00Z");

    @Mock
    private OverviewPolls overviewPolls;

    @Mock
    private AccessService accessService;

    @Mock
    private AvailabilityPollFilters pollFilters;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PersonRepository personRepository;

    private AvailabilitySummaryServiceImpl service;
    private final Authentication caller = new TestingAuthenticationToken("someone", "n/a");

    @BeforeEach
    void setUp() {
        service = new AvailabilitySummaryServiceImpl(
                overviewPolls, accessService, pollFilters, playerProfileRepository, personRepository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static OpenPoll poll(AvailabilityPollType kind, Instant closeAt, Set<UUID> audience, Set<UUID> responded) {
        Set<UUID> awaiting = new HashSet<>(audience);
        awaiting.removeAll(responded);
        return new OpenPoll(
                new OverviewPollDto(kind, UUID.randomUUID(), null, "p", responded.size(), audience.size(), closeAt),
                audience, responded, awaiting, true);
    }

    private static OpenPoll closed(Instant closeAt, Set<UUID> audience, Set<UUID> responded) {
        OpenPoll open = poll(AvailabilityPollType.SQUAD, closeAt, audience, responded);
        return new OpenPoll(open.poll(), audience, responded, open.awaiting(), false);
    }

    private static OpenPoll squad(Instant closeAt, Set<UUID> audience, Set<UUID> responded) {
        return poll(AvailabilityPollType.SQUAD, closeAt, audience, responded);
    }

    private void unrestrictedWith(OpenPoll... polls) {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.empty());
        when(pollFilters.resolve(caller, CLUB_ID, Optional.empty(), null, null, null, null, false))
                .thenReturn(AvailabilityPollFilter.OPEN_ONLY);
        when(overviewPolls.pollsWithPlayers(CLUB_ID, Optional.empty(), AvailabilityPollFilter.OPEN_ONLY))
                .thenReturn(List.of(polls));
    }

    private AvailabilitySummaryDto summary() {
        return service.summary(caller, CLUB_ID, null, null, null, null, false);
    }

    @Test
    void noOpenPollsGivesZeros() {
        unrestrictedWith();

        assertThat(summary()).isEqualTo(new AvailabilitySummaryDto(0, 0, 0, 0, 0));
    }

    @Test
    void pollsButNobodyRespondedCountsTheAudienceAndEveryoneStillToAnswer() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        unrestrictedWith(squad(null, Set.of(a, b), Set.of()));

        assertThat(summary()).isEqualTo(new AvailabilitySummaryDto(1, 0, 2, 2, 0));
    }

    @Test
    void aPlayerInSeveralPollsIsCountedOnceInAudienceAndResponded() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        unrestrictedWith(
                squad(null, Set.of(a, b), Set.of(a)),
                poll(AvailabilityPollType.GROUP, null, Set.of(a, b, c), Set.of(a, b)),
                squad(null, Set.of(a), Set.of(a)));

        AvailabilitySummaryDto result = summary();

        assertThat(result.openPolls()).isEqualTo(3);
        assertThat(result.playersInAudience()).isEqualTo(3);
        assertThat(result.playersResponded()).isEqualTo(2);
        // b (squad 1), c (group); a answered everything, and b is counted once
        assertThat(result.playersStillToAnswer()).isEqualTo(2);
    }

    @Test
    void aPlayerWhoAnsweredOnlyOneOfTheirPollsStillCountsAsResponded() {
        UUID a = UUID.randomUUID();
        unrestrictedWith(squad(null, Set.of(a), Set.of(a)), squad(null, Set.of(a), Set.of()));

        AvailabilitySummaryDto result = summary();

        assertThat(result.playersInAudience()).isEqualTo(1);
        assertThat(result.playersResponded()).isEqualTo(1);
        assertThat(result.playersStillToAnswer()).isEqualTo(1);
    }

    @Test
    void aPlayerOwingAnswersInSeveralPollsIsCountedOnceAsStillToAnswer() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        unrestrictedWith(
                squad(null, Set.of(a, b), Set.of()),
                poll(AvailabilityPollType.GROUP, null, Set.of(a), Set.of()),
                squad(null, Set.of(a), Set.of()));

        assertThat(summary().playersStillToAnswer()).isEqualTo(2);
    }

    @Test
    void aGroupPlayerWhoAnsweredOnlySomeWindowsStillOwesAnAnswer() {
        UUID a = UUID.randomUUID();
        // responded (any window) but awaiting (not every window)
        unrestrictedWith(new OpenPoll(
                new OverviewPollDto(AvailabilityPollType.GROUP, UUID.randomUUID(), null, "g", 0, 1, null),
                Set.of(a), Set.of(a), Set.of(a), true));

        AvailabilitySummaryDto result = summary();

        assertThat(result.playersResponded()).isEqualTo(1);
        assertThat(result.playersStillToAnswer()).isEqualTo(1);
    }

    @Test
    void closedPollsCountAsShownButNeverAsClosingSoon() {
        Set<UUID> none = Set.of();
        UUID a = UUID.randomUUID();
        OpenPoll closedPoll = closed(NOW.plus(Duration.ofHours(5)), Set.of(a), Set.of());
        AvailabilityPollFilter filter =
                new AvailabilityPollFilter(null, null, null, AvailabilityPollTypeFilter.ALL, true);
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.empty());
        when(pollFilters.resolve(caller, CLUB_ID, Optional.empty(), null, null, null, null, true)).thenReturn(filter);
        when(overviewPolls.pollsWithPlayers(CLUB_ID, Optional.empty(), filter))
                .thenReturn(List.of(closedPoll, squad(NOW.plus(Duration.ofHours(6)), none, none)));

        AvailabilitySummaryDto result = service.summary(caller, CLUB_ID, null, null, null, null, true);

        assertThat(result.openPolls()).isEqualTo(2);
        assertThat(result.closingSoon()).isEqualTo(1);
        assertThat(result.playersStillToAnswer()).isEqualTo(1);
    }

    @Test
    void theFilterIdsAreResolvedAndTheResultingFilterIsPassedToThePolls() {
        UUID league = UUID.randomUUID();
        UUID section = UUID.randomUUID();
        UUID team = UUID.randomUUID();
        AvailabilityPollFilter filter =
                new AvailabilityPollFilter(league, Set.of(section), team, AvailabilityPollTypeFilter.SQUAD, false);
        UUID a = UUID.randomUUID();
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.empty());
        when(pollFilters.resolve(
                        caller, CLUB_ID, Optional.empty(), league, section, team, AvailabilityPollTypeFilter.SQUAD, false))
                .thenReturn(filter);
        when(overviewPolls.pollsWithPlayers(CLUB_ID, Optional.empty(), filter))
                .thenReturn(List.of(squad(null, Set.of(a), Set.of())));

        AvailabilitySummaryDto result = service.summary(
                caller, CLUB_ID, league, section, team, AvailabilityPollTypeFilter.SQUAD, false);

        assertThat(result).isEqualTo(new AvailabilitySummaryDto(1, 0, 1, 1, 0));
    }

    @Test
    void anInvalidFilterIdPropagatesAndNothingIsLoaded() {
        UUID league = UUID.randomUUID();
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.empty());
        when(pollFilters.resolve(any(), any(), any(), any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenThrow(new NotFoundException("League not found: " + league));

        assertThatThrownBy(() -> service.summary(caller, CLUB_ID, league, null, null, null, false))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(overviewPolls);
    }

    @Test
    void closingSoonIsWithinTheNext48HoursOnly() {
        Set<UUID> none = Set.of();
        unrestrictedWith(
                squad(NOW.plus(Duration.ofHours(48)).minusSeconds(1), none, none),
                squad(NOW.plus(Duration.ofHours(48)), none, none),
                squad(NOW.plus(Duration.ofHours(48)).plusSeconds(1), none, none),
                squad(NOW.plusSeconds(1), none, none),
                squad(NOW, none, none),
                squad(NOW.minusSeconds(1), none, none),
                squad(NOW.minus(Duration.ofDays(3)), none, none),
                squad(null, none, none));

        AvailabilitySummaryDto result = summary();

        assertThat(result.openPolls()).isEqualTo(8);
        assertThat(result.closingSoon()).isEqualTo(3);
    }

    @Test
    void squadAndGroupPollsBothCountTowardsClosingSoon() {
        Set<UUID> none = Set.of();
        unrestrictedWith(
                squad(NOW.plus(Duration.ofHours(5)), none, none),
                poll(AvailabilityPollType.GROUP, NOW.plus(Duration.ofHours(6)), none, none));

        assertThat(summary().closingSoon()).isEqualTo(2);
    }

    @Test
    void theCallersAccessibleSectionsAreWhatIsPassedToThePolls() {
        UUID section = UUID.randomUUID();
        Optional<Set<UUID>> scope = Optional.of(Set.of(section));
        UUID a = UUID.randomUUID();
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(scope);
        when(pollFilters.resolve(caller, CLUB_ID, scope, null, null, null, null, false))
                .thenReturn(AvailabilityPollFilter.OPEN_ONLY);
        when(overviewPolls.pollsWithPlayers(CLUB_ID, scope, AvailabilityPollFilter.OPEN_ONLY))
                .thenReturn(List.of(squad(null, Set.of(a), Set.of(a))));

        assertThat(summary()).isEqualTo(new AvailabilitySummaryDto(1, 1, 1, 0, 0));
        verify(overviewPolls).pollsWithPlayers(CLUB_ID, scope, AvailabilityPollFilter.OPEN_ONLY);
    }

    @Test
    void aCallerWithNoAccessibleSectionsGetsZerosWithoutLoadingPolls() {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.of(Set.of()));
        when(pollFilters.resolve(caller, CLUB_ID, Optional.of(Set.of()), null, null, null, null, false))
                .thenReturn(AvailabilityPollFilter.OPEN_ONLY);

        assertThat(summary()).isEqualTo(new AvailabilitySummaryDto(0, 0, 0, 0, 0));
        verifyNoInteractions(overviewPolls);
    }

    // ---- players list (docs/specs/084) ----

    private final Map<UUID, String> nameById = new HashMap<>();

    private UUID player(String first, String last) {
        UUID id = UUID.randomUUID();
        nameById.put(id, first + " " + last);
        return id;
    }

    private void stubNames() {
        UUID personSeed = UUID.randomUUID();
        List<PlayerProfile> profiles = new ArrayList<>();
        List<Person> persons = new ArrayList<>();
        for (Map.Entry<UUID, String> entry : nameById.entrySet()) {
            UUID personId = UUID.randomUUID();
            String[] parts = entry.getValue().split(" ", 2);
            profiles.add(PlayerProfile.builder().id(entry.getKey()).personId(personId).build());
            persons.add(Person.builder().id(personId).firstName(parts[0]).lastName(parts.length > 1 ? parts[1] : "").build());
        }
        org.mockito.Mockito.lenient().when(playerProfileRepository.findAllById(ArgumentMatchers.anyIterable()))
                .thenReturn(profiles);
        org.mockito.Mockito.lenient().when(personRepository.findAllById(ArgumentMatchers.anyIterable())).thenReturn(persons);
    }

    private Page<AvailabilitySummaryPlayerDto> players(
            AvailabilitySummaryPlayerKind kind, boolean closingSoon, String search, Pageable pageable, OpenPoll... polls) {
        unrestrictedWith(polls);
        stubNames();
        return service.players(caller, CLUB_ID, kind, null, null, null, null, false, closingSoon, search, pageable);
    }

    private static final Pageable FIRST = PageRequest.of(0, 25);

    @Test
    void aPlayerInTwoPollsAppearsOnceWithBothPollRefs() {
        UUID a = player("Ann", "Adams");
        OpenPoll first = squad(null, Set.of(a), Set.of(a));
        OpenPoll second = poll(AvailabilityPollType.GROUP, null, Set.of(a), Set.of(a));

        Page<AvailabilitySummaryPlayerDto> result =
                players(AvailabilitySummaryPlayerKind.RESPONDED, false, null, FIRST, first, second);

        assertThat(result.getTotalElements()).isEqualTo(1);
        AvailabilitySummaryPlayerDto dto = result.getContent().get(0);
        assertThat(dto.displayName()).isEqualTo("Ann Adams");
        assertThat(dto.polls()).extracting(AvailabilitySummaryPlayerDto.PollRef::id)
                .containsExactlyInAnyOrder(first.poll().id(), second.poll().id());
        assertThat(dto.polls()).extracting(AvailabilitySummaryPlayerDto.PollRef::kind)
                .containsExactlyInAnyOrder(AvailabilityPollType.SQUAD, AvailabilityPollType.GROUP);
    }

    @Test
    void kindPicksRespondedOrAwaitingPlayersAndTotalsEqualTheCounters() {
        UUID a = player("Ann", "Adams");
        UUID b = player("Bob", "Brown");
        OpenPoll shown = squad(null, Set.of(a, b), Set.of(a));
        unrestrictedWith(shown);
        stubNames();

        Page<AvailabilitySummaryPlayerDto> responded = service.players(
                caller, CLUB_ID, AvailabilitySummaryPlayerKind.RESPONDED, null, null, null, null, false, false, null, FIRST);
        Page<AvailabilitySummaryPlayerDto> awaiting = service.players(
                caller, CLUB_ID, AvailabilitySummaryPlayerKind.AWAITING, null, null, null, null, false, false, null, FIRST);
        AvailabilitySummaryDto counters = summary();

        assertThat(responded.getContent()).extracting(AvailabilitySummaryPlayerDto::playerProfileId).containsExactly(a);
        assertThat(awaiting.getContent()).extracting(AvailabilitySummaryPlayerDto::playerProfileId).containsExactly(b);
        assertThat(responded.getTotalElements()).isEqualTo(counters.playersResponded());
        assertThat(awaiting.getTotalElements()).isEqualTo(counters.playersStillToAnswer());
    }

    @Test
    void searchIsACaseInsensitiveContainsOnTheDisplayName() {
        UUID a = player("Ann", "Adams");
        UUID b = player("Bob", "Brown");

        Page<AvailabilitySummaryPlayerDto> result = players(
                AvailabilitySummaryPlayerKind.AWAITING, false, "  OWN ", FIRST, squad(null, Set.of(a, b), Set.of()));

        assertThat(result.getContent()).extracting(AvailabilitySummaryPlayerDto::displayName).containsExactly("Bob Brown");
        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void closingSoonKeepsOnlyOpenPollsClosingWithin48Hours() {
        UUID soon = player("Sam", "Soon");
        UUID later = player("Lee", "Later");
        UUID shut = player("Cy", "Closed");
        OpenPoll closingSoon = squad(NOW.plus(Duration.ofHours(5)), Set.of(soon), Set.of());
        OpenPoll farAway = squad(NOW.plus(Duration.ofHours(49)), Set.of(later), Set.of());
        OpenPoll closedPoll = closed(NOW.plus(Duration.ofHours(5)), Set.of(shut), Set.of());

        Page<AvailabilitySummaryPlayerDto> result = players(
                AvailabilitySummaryPlayerKind.AWAITING, true, null, FIRST, closingSoon, farAway, closedPoll);

        assertThat(result.getContent()).extracting(AvailabilitySummaryPlayerDto::displayName).containsExactly("Sam Soon");
    }

    @Test
    void sortedByNumberOfPollsDescendingThenName() {
        UUID zed = player("Zed", "Zimmer");
        UUID amy = player("Amy", "Archer");
        UUID bea = player("Bea", "Baker");

        Page<AvailabilitySummaryPlayerDto> result = players(
                AvailabilitySummaryPlayerKind.AWAITING, false, null, FIRST,
                squad(null, Set.of(zed, amy, bea), Set.of()),
                squad(null, Set.of(zed), Set.of()));

        assertThat(result.getContent()).extracting(AvailabilitySummaryPlayerDto::displayName)
                .containsExactly("Zed Zimmer", "Amy Archer", "Bea Baker");
    }

    @Test
    void pagesAreSlicedAndPastTheEndIsEmpty() {
        Set<UUID> audience = new java.util.LinkedHashSet<>();
        for (int i = 0; i < 5; i++) {
            audience.add(player("P" + i, "X"));
        }
        OpenPoll shown = squad(null, audience, Set.of());

        Page<AvailabilitySummaryPlayerDto> second =
                players(AvailabilitySummaryPlayerKind.AWAITING, false, null, PageRequest.of(1, 2), shown);
        Page<AvailabilitySummaryPlayerDto> past =
                players(AvailabilitySummaryPlayerKind.AWAITING, false, null, PageRequest.of(9, 2), shown);

        assertThat(second.getContent()).extracting(AvailabilitySummaryPlayerDto::displayName).containsExactly("P2 X", "P3 X");
        assertThat(second.getTotalElements()).isEqualTo(5);
        assertThat(second.getTotalPages()).isEqualTo(3);
        assertThat(past.getContent()).isEmpty();
        assertThat(past.getTotalElements()).isEqualTo(5);
    }

    @Test
    void thePageSizeIsClampedToOneHundred() {
        Set<UUID> audience = new java.util.LinkedHashSet<>();
        for (int i = 0; i < 130; i++) {
            audience.add(player("P" + i, "X"));
        }

        Page<AvailabilitySummaryPlayerDto> result = players(
                AvailabilitySummaryPlayerKind.AWAITING, false, null, PageRequest.of(0, 500), squad(null, audience, Set.of()));

        assertThat(result.getContent()).hasSize(100);
        assertThat(result.getSize()).isEqualTo(100);
        assertThat(result.getTotalElements()).isEqualTo(130);
    }

    @Test
    void noPollsOrNobodyOwingGivesAnEmptyPageWithoutNameLookups() {
        Page<AvailabilitySummaryPlayerDto> none = players(AvailabilitySummaryPlayerKind.AWAITING, false, null, FIRST);
        UUID a = player("Ann", "Adams");
        Page<AvailabilitySummaryPlayerDto> nobody = players(
                AvailabilitySummaryPlayerKind.AWAITING, false, null, FIRST, squad(null, Set.of(a), Set.of(a)));

        assertThat(none.getContent()).isEmpty();
        assertThat(nobody.getContent()).isEmpty();
        assertThat(nobody.getTotalElements()).isZero();
        verifyNoInteractions(playerProfileRepository, personRepository);
    }

    @Test
    void aCallerWithNoAccessibleSectionsGetsAnEmptyPageWithoutLoadingPolls() {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.of(Set.of()));
        when(pollFilters.resolve(caller, CLUB_ID, Optional.of(Set.of()), null, null, null, null, false))
                .thenReturn(AvailabilityPollFilter.OPEN_ONLY);

        Page<AvailabilitySummaryPlayerDto> result = service.players(
                caller, CLUB_ID, AvailabilitySummaryPlayerKind.RESPONDED, null, null, null, null, false, false, null, FIRST);

        assertThat(result.getContent()).isEmpty();
        verifyNoInteractions(overviewPolls);
    }

    @Test
    void anInvalidFilterIdPropagatesFromThePlayersListToo() {
        when(accessService.accessibleSectionIds(caller, CLUB_ID)).thenReturn(Optional.empty());
        when(pollFilters.resolve(any(), any(), any(), any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenThrow(new NotFoundException("League not found"));

        assertThatThrownBy(() -> service.players(caller, CLUB_ID, AvailabilitySummaryPlayerKind.AWAITING,
                        UUID.randomUUID(), null, null, null, false, false, null, FIRST))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void theKindParameterParsesCaseInsensitivelyAndRejectsAnythingElse() {
        assertThat(AvailabilitySummaryPlayerKind.parse("responded")).isEqualTo(AvailabilitySummaryPlayerKind.RESPONDED);
        assertThat(AvailabilitySummaryPlayerKind.parse("AWAITING")).isEqualTo(AvailabilitySummaryPlayerKind.AWAITING);
        assertThatThrownBy(() -> AvailabilitySummaryPlayerKind.parse("nope"))
                .isInstanceOf(com.cricketlegend.exception.ValidationException.class);
        assertThatThrownBy(() -> AvailabilitySummaryPlayerKind.parse(null))
                .isInstanceOf(com.cricketlegend.exception.ValidationException.class);
    }
}
