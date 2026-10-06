package com.cricketlegend.service.support;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.SelectionRejectionReason;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.PlayerNameDto;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerAgeIneligibleException;
import com.cricketlegend.exception.PlayerNotConfirmedException;
import com.cricketlegend.exception.PlayerNotInSquadException;
import com.cricketlegend.exception.PlayerSaidUnavailableException;
import com.cricketlegend.exception.PlayerTakenForSlotException;
import com.cricketlegend.repository.SelectionLockRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The one entry point for the team-selection rules of docs/specs/076-team-selection.md, composed of
 * {@link SelectionLimitsResolver}, {@link MatchSlots}, {@link SelectionAvailabilityResolver} and
 * {@link SelectionEligibility}. Both {@code MatchSideServiceImpl} (the existing endpoints) and
 * {@code MatchSelectionServiceImpl} (pool and apply) call it, so nothing is written twice. A player
 * who may not be selected gets exactly one rejection, by precedence: not in the pool, age
 * ineligible, said unavailable, not confirmed (unsure or no response), taken for the slot
 * (releasing him would not help if he also said unavailable).
 */
@Component
public class SelectionRules {

    private final SelectionLimitsResolver limitsResolver;
    private final MatchSlots matchSlots;
    private final SelectionAvailabilityResolver availabilityResolver;
    private final SelectionEligibility eligibility;
    private final SelectionLockRepository lockRepository;
    private final TeamRepository teamRepository;

    public SelectionRules(
            SelectionLimitsResolver limitsResolver,
            MatchSlots matchSlots,
            SelectionAvailabilityResolver availabilityResolver,
            SelectionEligibility eligibility,
            SelectionLockRepository lockRepository,
            TeamRepository teamRepository) {
        this.limitsResolver = limitsResolver;
        this.matchSlots = matchSlots;
        this.availabilityResolver = availabilityResolver;
        this.eligibility = eligibility;
        this.lockRepository = lockRepository;
        this.teamRepository = teamRepository;
    }

    public SelectionLimitsDto limits(Match match) {
        return limitsResolver.limits(match);
    }

    public SelectionEligibility eligibility() {
        return eligibility;
    }

    public SelectionAvailabilityResolver availability() {
        return availabilityResolver;
    }

    public Team team(UUID teamId) {
        return teamRepository.findById(teamId).orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
    }

    /**
     * The race guard (section 9): takes a Postgres advisory transaction lock for each player, in
     * ascending id order so two requests cannot deadlock. Every path that ADDS a player calls this
     * before {@link #evaluate}, inside its transaction.
     */
    public void lockPlayers(Collection<UUID> playerIds) {
        for (UUID playerId : new TreeSet<>(playerIds)) {
            lockRepository.lockPlayer(playerId);
        }
    }

    /**
     * Evaluates {@code playerIds} for {@code teamId}'s side of {@code match}: availability and taken
     * info for every player, and one rejection for each who may not be selected.
     */
    public SelectionEvaluation evaluate(Match match, UUID teamId, Collection<UUID> playerIds) {
        Set<UUID> ids = new LinkedHashSet<>(playerIds);
        return evaluate(match, teamId, ids, availabilityResolver.coverage(match.getId(), teamId),
                eligibility.loadPlayers(ids));
    }

    /** As {@link #evaluate(Match, UUID, Collection)} with the coverage and players the caller already loaded. */
    public SelectionEvaluation evaluate(
            Match match,
            UUID teamId,
            Collection<UUID> playerIds,
            MatchPollCoverageService.Coverage coverage,
            Map<UUID, SelectionEligibility.PlayerInfo> players) {
        Set<UUID> ids = new LinkedHashSet<>(playerIds);
        Team team = team(teamId);
        Map<UUID, SelectionAvailability> availability = availabilityResolver.statuses(match, teamId, coverage, ids);
        Map<UUID, TakenBy> taken = matchSlots.taken(match, teamId, ids);
        Set<UUID> outside = eligibility.notInPool(match, team, ids, players);
        Map<UUID, String> ageProblems = eligibility.ageProblems(match, ids, players);

        Map<UUID, SelectionRejection> rejections = new HashMap<>();
        for (UUID playerId : ids) {
            String name = nameOf(players, playerId);
            SelectionRejection rejection = null;
            if (outside.contains(playerId)) {
                rejection = new SelectionRejection(playerId, name, SelectionRejectionReason.NOT_IN_POOL,
                        name + " is not on this team's roster or in its section", null);
            } else if (ageProblems.containsKey(playerId)) {
                rejection = new SelectionRejection(playerId, name, SelectionRejectionReason.AGE_INELIGIBLE,
                        ageProblems.get(playerId), null);
            } else if (availability.get(playerId) == SelectionAvailability.UNAVAILABLE) {
                rejection = new SelectionRejection(playerId, name, SelectionRejectionReason.SAID_UNAVAILABLE,
                        name + " said he is unavailable for this match.", null);
            } else if (availability.get(playerId) == SelectionAvailability.UNSURE) {
                rejection = new SelectionRejection(playerId, name, SelectionRejectionReason.NOT_CONFIRMED,
                        name + " is unsure for this match. Set his answer to Available first.", null);
            } else if (availability.get(playerId) == SelectionAvailability.NO_RESPONSE) {
                rejection = new SelectionRejection(playerId, name, SelectionRejectionReason.NOT_CONFIRMED,
                        name + " hasn't confirmed he is available for this match. Set his answer to Available first.",
                        null);
            } else if (taken.containsKey(playerId)) {
                TakenBy holder = taken.get(playerId);
                rejection = new SelectionRejection(playerId, name, SelectionRejectionReason.TAKEN_FOR_SLOT,
                        name + " is already in " + holder.teamName() + "'s selection for " + holder.slotText()
                                + ". Release him there first.",
                        holder);
            }
            if (rejection != null) {
                rejections.put(playerId, rejection);
            }
        }
        return new SelectionEvaluation(coverage, players, availability, taken, rejections);
    }

    /** The single-player write paths: throws the named exception for the player's rejection, if any. */
    public void requireSelectable(Match match, UUID teamId, UUID playerId) {
        SelectionRejection rejection = evaluate(match, teamId, Set.of(playerId)).rejections().get(playerId);
        if (rejection == null) {
            return;
        }
        switch (rejection.reason()) {
            case NOT_IN_POOL -> throw new PlayerNotInSquadException(rejection.message());
            case AGE_INELIGIBLE -> throw new PlayerAgeIneligibleException(rejection.message());
            case SAID_UNAVAILABLE -> throw new PlayerSaidUnavailableException(rejection.message());
            case NOT_CONFIRMED -> throw new PlayerNotConfirmedException(rejection.message());
            default -> throw new PlayerTakenForSlotException(rejection.message());
        }
    }

    /** One batched profile+person lookup for the given players (unknown ids absent). */
    public Map<UUID, PlayerNameDto> playerInfo(Collection<UUID> playerIds) {
        Map<UUID, PlayerNameDto> names = new HashMap<>();
        eligibility.loadPlayers(new HashSet<>(playerIds)).forEach(
                (id, info) -> names.put(id, new PlayerNameDto(info.firstName(), info.lastName())));
        return names;
    }

    /** Display names for a set of players (falls back to the id when a profile cannot be resolved). */
    public Map<UUID, String> playerNames(Collection<UUID> playerIds) {
        Map<UUID, SelectionEligibility.PlayerInfo> players = eligibility.loadPlayers(new HashSet<>(playerIds));
        Map<UUID, String> names = new HashMap<>();
        for (UUID playerId : playerIds) {
            names.put(playerId, nameOf(players, playerId));
        }
        return names;
    }

    private String nameOf(Map<UUID, SelectionEligibility.PlayerInfo> players, UUID playerId) {
        SelectionEligibility.PlayerInfo info = players.get(playerId);
        return info == null ? "Player " + playerId : info.fullName();
    }
}
