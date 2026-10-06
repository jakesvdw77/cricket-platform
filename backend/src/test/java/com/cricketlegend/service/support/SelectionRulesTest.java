package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.SelectionRejectionReason;
import com.cricketlegend.domain.Team;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerAgeIneligibleException;
import com.cricketlegend.exception.PlayerNotConfirmedException;
import com.cricketlegend.exception.PlayerNotInSquadException;
import com.cricketlegend.exception.PlayerSaidUnavailableException;
import com.cricketlegend.exception.PlayerTakenForSlotException;
import com.cricketlegend.repository.SelectionLockRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService.Coverage;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Unit tests for {@link SelectionRules}: the reason precedence (the 076 build record: age
 * ineligible, said unavailable, not confirmed, taken for the slot, after not in the pool), the
 * message texts, the named exception each reason maps to on the single-player paths, and the
 * advisory locks taken in ascending id order. The four collaborators are mocked; their own rules
 * have their own tests.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SelectionRulesTest {

    @Mock
    private SelectionLimitsResolver limitsResolver;

    @Mock
    private MatchSlots matchSlots;

    @Mock
    private SelectionAvailabilityResolver availabilityResolver;

    @Mock
    private SelectionEligibility eligibility;

    @Mock
    private SelectionLockRepository lockRepository;

    @Mock
    private TeamRepository teamRepository;

    private SelectionRules rules;
    private final Team team = Team.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID())
            .sectionId(UUID.randomUUID()).name("Villagers 1").active(true).build();
    private final Match match = Match.builder().id(UUID.randomUUID()).clubId(team.getClubId())
            .homeTeamId(team.getId()).seasonId(UUID.randomUUID()).matchDate(Instant.now()).active(true).build();
    private final Map<UUID, PlayerInfo> players = new HashMap<>();
    private final Map<UUID, SelectionAvailability> availability = new HashMap<>();
    private final Map<UUID, TakenBy> taken = new HashMap<>();
    private final Map<UUID, String> ageProblems = new HashMap<>();
    private final java.util.Set<UUID> outside = new java.util.HashSet<>();

    @BeforeEach
    void setUp() {
        rules = new SelectionRules(limitsResolver, matchSlots, availabilityResolver, eligibility, lockRepository,
                teamRepository);
        when(teamRepository.findById(team.getId())).thenReturn(Optional.of(team));
        when(availabilityResolver.coverage(any(), any())).thenReturn(Coverage.NONE);
        when(eligibility.loadPlayers(any())).thenReturn(players);
        when(availabilityResolver.statuses(any(), any(), any(), any())).thenReturn(availability);
        when(matchSlots.taken(any(), any(), any())).thenReturn(taken);
        when(eligibility.notInPool(any(), any(), any(), any())).thenReturn(outside);
        when(eligibility.ageProblems(any(), any(), any())).thenReturn(ageProblems);
    }

    private UUID player(String first, SelectionAvailability status) {
        UUID id = UUID.randomUUID();
        players.put(id, new PlayerInfo(id, team.getClubId(), true, first, "Smith", null, null));
        availability.put(id, status);
        return id;
    }

    private TakenBy holder() {
        return new TakenBy(UUID.randomUUID(), "Villagers 2", team.getClubId(), UUID.randomUUID(), UUID.randomUUID(),
                Instant.now(), "Sat 6 Jun (morning)", UUID.randomUUID(), false, false);
    }

    private SelectionRejection rejectionOf(UUID id) {
        return rules.evaluate(match, team.getId(), List.of(id)).rejections().get(id);
    }

    @Test
    void anAvailableAndFreePlayerHasNoRejection() {
        UUID id = player("Ann", SelectionAvailability.AVAILABLE);

        assertThat(rules.evaluate(match, team.getId(), List.of(id)).rejections()).isEmpty();
    }

    @Test
    void aNotPolledPlayerWhoIsFreeIsSelectable() {
        UUID id = player("Ann", SelectionAvailability.NOT_POLLED);

        assertThat(rejectionOf(id)).isNull();
    }

    @Test
    void unsureAndNoResponseAreRejectedNotConfirmedWithTheirOwnMessages() {
        UUID unsure = player("Una", SelectionAvailability.UNSURE);
        UUID silent = player("Sid", SelectionAvailability.NO_RESPONSE);

        assertThat(rejectionOf(unsure).reason()).isEqualTo(SelectionRejectionReason.NOT_CONFIRMED);
        assertThat(rejectionOf(unsure).message())
                .isEqualTo("Una Smith is unsure for this match. Set his answer to Available first.");
        assertThat(rejectionOf(silent).reason()).isEqualTo(SelectionRejectionReason.NOT_CONFIRMED);
        assertThat(rejectionOf(silent).message())
                .isEqualTo("Sid Smith hasn't confirmed he is available for this match. Set his answer to Available first.");
    }

    @Test
    void unavailableIsRejectedSaidUnavailable() {
        UUID id = player("Mark", SelectionAvailability.UNAVAILABLE);

        SelectionRejection rejection = rejectionOf(id);

        assertThat(rejection.reason()).isEqualTo(SelectionRejectionReason.SAID_UNAVAILABLE);
        assertThat(rejection.message()).isEqualTo("Mark Smith said he is unavailable for this match.");
        assertThat(rejection.playerProfileId()).isEqualTo(id);
        assertThat(rejection.playerName()).isEqualTo("Mark Smith");
    }

    @Test
    void takenIsRejectedTakenForSlotWithTheHolderAndAReleaseHint() {
        UUID id = player("Liam", SelectionAvailability.AVAILABLE);
        TakenBy holder = holder();
        taken.put(id, holder);

        SelectionRejection rejection = rejectionOf(id);

        assertThat(rejection.reason()).isEqualTo(SelectionRejectionReason.TAKEN_FOR_SLOT);
        assertThat(rejection.taken()).isSameAs(holder);
        assertThat(rejection.message())
                .isEqualTo("Liam Smith is already in Villagers 2's selection for Sat 6 Jun (morning). Release him there first.");
    }

    @Test
    void notInThePoolIsRejectedNotInPool() {
        UUID id = player("Stranger", SelectionAvailability.AVAILABLE);
        outside.add(id);

        SelectionRejection rejection = rejectionOf(id);

        assertThat(rejection.reason()).isEqualTo(SelectionRejectionReason.NOT_IN_POOL);
        assertThat(rejection.message()).isEqualTo("Stranger Smith is not on this team's roster or in its section");
    }

    @Test
    void anUnknownPlayerIsNamedByIdInTheMessage() {
        UUID unknown = UUID.randomUUID();
        outside.add(unknown);

        assertThat(rejectionOf(unknown).message()).startsWith("Player " + unknown + " is not on");
    }

    @Test
    void precedenceIsNotInPoolThenAgeThenUnavailableThenNotConfirmedThenTaken() {
        UUID everything = player("E", SelectionAvailability.UNAVAILABLE);
        outside.add(everything);
        ageProblems.put(everything, "too old");
        taken.put(everything, holder());

        UUID ageAndBelow = player("A", SelectionAvailability.UNAVAILABLE);
        ageProblems.put(ageAndBelow, "too old");
        taken.put(ageAndBelow, holder());

        UUID unavailableAndTaken = player("U", SelectionAvailability.UNAVAILABLE);
        taken.put(unavailableAndTaken, holder());

        UUID unsureAndTaken = player("N", SelectionAvailability.UNSURE);
        taken.put(unsureAndTaken, holder());

        UUID noResponseAndTaken = player("R", SelectionAvailability.NO_RESPONSE);
        taken.put(noResponseAndTaken, holder());

        Map<UUID, SelectionRejection> result = rules.evaluate(match, team.getId(),
                List.of(everything, ageAndBelow, unavailableAndTaken, unsureAndTaken, noResponseAndTaken)).rejections();

        assertThat(result.get(everything).reason()).isEqualTo(SelectionRejectionReason.NOT_IN_POOL);
        assertThat(result.get(ageAndBelow).reason()).isEqualTo(SelectionRejectionReason.AGE_INELIGIBLE);
        assertThat(result.get(ageAndBelow).message()).isEqualTo("too old");
        assertThat(result.get(unavailableAndTaken).reason()).isEqualTo(SelectionRejectionReason.SAID_UNAVAILABLE);
        assertThat(result.get(unsureAndTaken).reason()).isEqualTo(SelectionRejectionReason.NOT_CONFIRMED);
        assertThat(result.get(noResponseAndTaken).reason()).isEqualTo(SelectionRejectionReason.NOT_CONFIRMED);
    }

    @Test
    void evaluationExposesAvailabilityAndTakenForEveryPlayerEvenWhenSelectable() {
        UUID id = player("Ann", SelectionAvailability.AVAILABLE);

        var evaluation = rules.evaluate(match, team.getId(), List.of(id));

        assertThat(evaluation.availability()).containsEntry(id, SelectionAvailability.AVAILABLE);
        assertThat(evaluation.players()).containsKey(id);
        assertThat(evaluation.taken()).isEmpty();
    }

    // --- single-player paths ---

    @Test
    void requireSelectableDoesNothingForASelectablePlayer() {
        UUID id = player("Ann", SelectionAvailability.AVAILABLE);

        rules.requireSelectable(match, team.getId(), id);
    }

    @Test
    void requireSelectableThrowsTheNamedExceptionForEachReason() {
        UUID outsider = player("O", SelectionAvailability.AVAILABLE);
        outside.add(outsider);
        UUID young = player("Y", SelectionAvailability.AVAILABLE);
        ageProblems.put(young, "too young");
        UUID gone = player("G", SelectionAvailability.UNAVAILABLE);
        UUID unsure = player("U", SelectionAvailability.UNSURE);
        UUID busy = player("B", SelectionAvailability.AVAILABLE);
        taken.put(busy, holder());

        assertThatThrownBy(() -> rules.requireSelectable(match, team.getId(), outsider))
                .isInstanceOf(PlayerNotInSquadException.class);
        assertThatThrownBy(() -> rules.requireSelectable(match, team.getId(), young))
                .isInstanceOf(PlayerAgeIneligibleException.class).hasMessage("too young");
        assertThatThrownBy(() -> rules.requireSelectable(match, team.getId(), gone))
                .isInstanceOf(PlayerSaidUnavailableException.class);
        assertThatThrownBy(() -> rules.requireSelectable(match, team.getId(), unsure))
                .isInstanceOf(PlayerNotConfirmedException.class);
        assertThatThrownBy(() -> rules.requireSelectable(match, team.getId(), busy))
                .isInstanceOf(PlayerTakenForSlotException.class);
    }

    @Test
    void teamOfAnUnknownIdThrowsNotFoundException() {
        assertThatThrownBy(() -> rules.team(UUID.randomUUID())).isInstanceOf(NotFoundException.class);
    }

    // --- locks ---

    @Test
    void lockPlayersTakesTheLocksInAscendingIdOrderWhateverTheInputOrder() {
        UUID low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID mid = UUID.fromString("00000000-0000-0000-0000-000000000002");
        UUID high = UUID.fromString("00000000-0000-0000-0000-000000000003");

        rules.lockPlayers(List.of(high, low, mid));

        InOrder order = inOrder(lockRepository);
        order.verify(lockRepository).lockPlayer(low);
        order.verify(lockRepository).lockPlayer(mid);
        order.verify(lockRepository).lockPlayer(high);
    }

    @Test
    void lockPlayersLocksAnIdGivenTwiceOnce() {
        UUID id = UUID.randomUUID();

        rules.lockPlayers(List.of(id, id));

        org.mockito.Mockito.verify(lockRepository, org.mockito.Mockito.times(1)).lockPlayer(id);
    }

    @Test
    void playerNamesFallBackToThePlayerIdForAnUnresolvedProfile() {
        UUID known = player("Ann", SelectionAvailability.AVAILABLE);
        UUID unknown = UUID.randomUUID();

        Map<UUID, String> names = rules.playerNames(Set.of(known, unknown));

        assertThat(names).containsEntry(known, "Ann Smith").containsEntry(unknown, "Player " + unknown);
    }
}
