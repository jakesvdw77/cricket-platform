package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.PollCoverageKind;
import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.SelectionPoolBasis;
import com.cricketlegend.domain.SelectionRejectionReason;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.ApplySelectionRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.SelectionCoveringPollDto;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.dto.SelectionPoolDto;
import com.cricketlegend.dto.SelectionPoolEntryDto;
import com.cricketlegend.dto.SelectionRejectionDto;
import com.cricketlegend.dto.SelectionEntryRequest;
import com.cricketlegend.dto.SelectionTakenDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SelectionRejectedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchSideMapper;
import com.cricketlegend.mapper.SelectionMapper;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import com.cricketlegend.service.MatchSelectionService;
import com.cricketlegend.service.support.SelectionEligibility;
import com.cricketlegend.service.support.SelectionEvaluation;
import com.cricketlegend.service.support.SelectionRejection;
import com.cricketlegend.service.support.SelectionRules;
import com.cricketlegend.service.support.SelectionSideWriter;
import com.cricketlegend.service.support.TakenBy;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/076-team-selection.md: the selection pool read and the atomic apply. Both lean on
 * {@link SelectionRules} (the same checks the single-player endpoints run) and {@link
 * SelectionSideWriter} (the same row writes), so nothing is written twice. The default pool is the
 * team's season roster, or for a group-poll-covered match the players who said Available; whole
 * section adds every active player tagged to the team's section tree. The side's currently selected
 * players are always listed. {@link #apply} collects every rejection before any write, so a refusal
 * persists nothing; it takes the per-player advisory locks first (section 9), re-validates only
 * players being added (kept players are grandfathered), and un-announces the side like any edit.
 */
@Service
public class MatchSelectionServiceImpl implements MatchSelectionService {

    /** The grid's {@code MAX_PLAYERS}: the most entries a pool returns. */
    static final int MAX_POOL_ENTRIES = 500;

    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final SelectionRules selectionRules;
    private final SelectionSideWriter sideWriter;
    private final SelectionMapper selectionMapper;
    private final MatchSideMapper matchSideMapper;
    private final AccessService accessService;

    public MatchSelectionServiceImpl(
            MatchRepository matchRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            SelectionRules selectionRules,
            SelectionSideWriter sideWriter,
            SelectionMapper selectionMapper,
            MatchSideMapper matchSideMapper,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.selectionRules = selectionRules;
        this.sideWriter = sideWriter;
        this.selectionMapper = selectionMapper;
        this.matchSideMapper = matchSideMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public SelectionPoolDto pool(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID teamId,
            boolean wholeSection,
            String q) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        if (!teamId.equals(match.getHomeTeamId()) && !teamId.equals(match.getAwayTeamId())) {
            throw new ValidationException(
                    "teamId " + teamId + " is not one of this match's own home/away team ids");
        }
        Team team = selectionRules.team(teamId);
        SelectionEligibility eligibility = selectionRules.eligibility();

        MatchSide side = matchSideRepository.findByMatchIdAndTeamId(matchId, teamId).orElse(null);
        Set<UUID> selectedIds = side == null
                ? Set.of()
                : matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(side.getId()).stream()
                        .map(MatchSidePlayer::getPlayerProfileId)
                        .collect(Collectors.toSet());

        MatchPollCoverageService.Coverage coverage = selectionRules.availability().coverage(matchId, teamId);
        boolean groupCovered = coverage.kind() == MatchPollCoverageService.Kind.GROUP;
        List<TeamSquadMember> roster = eligibility.roster(match, team);
        Map<UUID, Integer> squadNumbers = new HashMap<>();
        roster.forEach(member -> squadNumbers.put(member.getPlayerProfileId(), member.getJerseyNumber()));

        Set<UUID> candidateIds = new LinkedHashSet<>(selectedIds);
        if (wholeSection) {
            candidateIds.addAll(eligibility.poolMemberIds(match, team));
        } else if (groupCovered) {
            Set<UUID> members = eligibility.poolMemberIds(match, team);
            selectionRules.availability().availableOnGroupPoll(coverage).stream()
                    .filter(members::contains)
                    .forEach(candidateIds::add);
        } else {
            roster.forEach(member -> candidateIds.add(member.getPlayerProfileId()));
        }

        Map<UUID, SelectionEligibility.PlayerInfo> players = eligibility.loadPlayers(candidateIds);
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        Comparator<UUID> byName = Comparator
                .comparing((UUID id) -> players.get(id).firstName().toLowerCase(Locale.ROOT))
                .thenComparing(id -> players.get(id).lastName().toLowerCase(Locale.ROOT));
        // Selected players are always listed (not subject to q or the cap); the cap counts the rest.
        List<UUID> others = candidateIds.stream()
                .filter(id -> players.containsKey(id) && !selectedIds.contains(id))
                .filter(id -> isListable(players.get(id), clubId))
                .filter(id -> needle.isEmpty() || matches(players.get(id), needle))
                .sorted(byName)
                .toList();
        boolean truncated = others.size() > MAX_POOL_ENTRIES;
        if (truncated) {
            others = others.subList(0, MAX_POOL_ENTRIES);
        }
        List<UUID> listed = new ArrayList<>(others);
        selectedIds.stream().filter(players::containsKey).forEach(listed::add);
        listed.sort(byName);

        SelectionEvaluation evaluation = selectionRules.evaluate(match, teamId, listed, coverage, players);
        Map<UUID, Boolean> canReleaseByTeam = new HashMap<>();
        List<SelectionPoolEntryDto> entries = new ArrayList<>();
        for (UUID id : listed) {
            boolean selected = selectedIds.contains(id);
            SelectionRejection rejection = selected ? null : evaluation.rejections().get(id);
            TakenBy taken = evaluation.taken().get(id);
            entries.add(selectionMapper.toEntryDto(
                    players.get(id),
                    squadNumbers.get(id) != null ? squadNumbers.get(id) : players.get(id).profileJerseyNumber(),
                    evaluation.availability().getOrDefault(id, SelectionAvailability.NOT_POLLED),
                    selected,
                    rejection == null,
                    rejection == null ? null : rejection.reason(),
                    rejection == null ? null : rejection.message(),
                    takenDto(authentication, clubId, taken, canReleaseByTeam)));
        }

        return new SelectionPoolDto(
                matchId,
                teamId,
                side == null ? null : side.getId(),
                groupCovered ? SelectionPoolBasis.POLL_AVAILABLE : SelectionPoolBasis.ROSTER,
                wholeSection,
                coveringPoll(matchId, coverage),
                truncated,
                entries);
    }

    @Override
    @Transactional
    public MatchSideDto apply(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, ApplySelectionRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        List<SelectionEntryRequest> entries = request.players();
        if (entries.stream().anyMatch(java.util.Objects::isNull)) {
            throw new ValidationException("players must not contain null entries");
        }
        Map<UUID, SelectionEntryRequest> requested = new HashMap<>();
        for (SelectionEntryRequest entry : entries) {
            if (requested.put(entry.playerProfileId(), entry) != null) {
                throw new ValidationException(
                        "players must not contain player " + entry.playerProfileId() + " twice");
            }
        }
        SelectionLimitsDto limits = selectionRules.limits(match);
        List<MatchSidePlayer> rows = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId);
        Map<UUID, MatchSidePlayer> currentByPlayerId =
                rows.stream().collect(Collectors.toMap(MatchSidePlayer::getPlayerProfileId, row -> row));
        List<UUID> added = entries.stream()
                .map(SelectionEntryRequest::playerProfileId)
                .filter(id -> !currentByPlayerId.containsKey(id))
                .toList();
        List<UUID> removed = currentByPlayerId.keySet().stream().filter(id -> !requested.containsKey(id)).toList();

        selectionRules.lockPlayers(added);
        List<SelectionRejection> rejections = collectRejections(match, side, limits, entries, added, currentByPlayerId);
        if (!rejections.isEmpty()) {
            throw rejected(authentication, clubId, rejections);
        }

        sideWriter.removePlayers(side, removed);
        for (UUID playerId : added) {
            PlayingRole role = requested.get(playerId).role();
            sideWriter.addPlayer(side.getId(), playerId, role == null ? PlayingRole.BATSMAN : role, null);
        }
        for (SelectionEntryRequest entry : entries) {
            MatchSidePlayer kept = currentByPlayerId.get(entry.playerProfileId());
            if (kept != null && entry.role() != null) {
                kept.setRole(entry.role());
                matchSidePlayerRepository.save(kept);
            }
        }
        sideWriter.assignOrder(sideId, finalOrder(entries, currentByPlayerId));

        if (side.isAnnounced()) {
            side.setAnnounced(false);
        }
        side = matchSideRepository.save(side);

        List<MatchSidePlayer> finalRows = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId);
        return matchSideMapper.toDto(side, finalRows, limits, selectionRules.playerInfo(
                finalRows.stream().map(MatchSidePlayer::getPlayerProfileId).toList()));
    }

    /** Every reason the request cannot be applied: the whole-request limit, bad positions, blocked adds. */
    private List<SelectionRejection> collectRejections(
            Match match,
            MatchSide side,
            SelectionLimitsDto limits,
            List<SelectionEntryRequest> entries,
            List<UUID> added,
            Map<UUID, MatchSidePlayer> currentByPlayerId) {
        List<SelectionRejection> rejections = new ArrayList<>();
        if (entries.size() > limits.maxSelected()) {
            rejections.add(new SelectionRejection(null, null, SelectionRejectionReason.TEAM_FULL,
                    "Team is full: " + limits.maxSelected() + " is the most that can be selected", null));
        }
        int positioned = finalOrder(entries, currentByPlayerId).size();
        if (positioned > limits.battingPlaces()) {
            rejections.add(new SelectionRejection(null, null, SelectionRejectionReason.POSITION_INVALID,
                    positioned + " players would have a batting position but only " + limits.battingPlaces()
                            + " places exist", null));
        }
        Map<UUID, String> names = selectionRules.playerNames(
                entries.stream().map(SelectionEntryRequest::playerProfileId).toList());
        Set<Integer> usedPositions = new HashSet<>();
        for (SelectionEntryRequest entry : entries) {
            SelectionRejection problem = positionProblem(entry, limits, side, usedPositions, names);
            if (problem != null) {
                rejections.add(problem);
            }
        }
        if (!added.isEmpty()) {
            SelectionEvaluation evaluation = selectionRules.evaluate(match, side.getTeamId(), added);
            for (UUID playerId : added) {
                SelectionRejection rejection = evaluation.rejections().get(playerId);
                if (rejection != null) {
                    rejections.add(rejection);
                }
            }
        }
        return rejections;
    }

    private SelectionRejection positionProblem(
            SelectionEntryRequest entry,
            SelectionLimitsDto limits,
            MatchSide side,
            Set<Integer> usedPositions,
            Map<UUID, String> names) {
        Integer position = entry.battingOrder();
        if (position == null) {
            return null;
        }
        UUID playerId = entry.playerProfileId();
        String message = null;
        if (playerId.equals(side.getTwelfthManPlayerId())) {
            message = names.get(playerId) + " is the 12th man and has no batting position";
        } else if (position < 1 || position > limits.battingPlaces()) {
            message = "Batting position " + position + " is outside 1 to " + limits.battingPlaces();
        } else if (!usedPositions.add(position)) {
            message = "Batting position " + position + " is used more than once";
        }
        return message == null
                ? null
                : new SelectionRejection(
                        playerId, names.get(playerId), SelectionRejectionReason.POSITION_INVALID, message, null);
    }

    /**
     * The batting order after the apply: explicitly positioned players at their position, every
     * other kept player who already had one filling the remaining places in his existing order;
     * gaps are closed. Added players without a position (and the kept 12th man) have none.
     */
    private List<UUID> finalOrder(List<SelectionEntryRequest> entries, Map<UUID, MatchSidePlayer> currentByPlayerId) {
        java.util.TreeMap<Integer, UUID> explicit = new java.util.TreeMap<>();
        for (SelectionEntryRequest entry : entries) {
            if (entry.battingOrder() != null) {
                explicit.put(entry.battingOrder(), entry.playerProfileId());
            }
        }
        List<UUID> implied = entries.stream()
                .filter(entry -> entry.battingOrder() == null)
                .map(SelectionEntryRequest::playerProfileId)
                .filter(id -> currentByPlayerId.containsKey(id) && currentByPlayerId.get(id).getBattingOrder() != null)
                .sorted(Comparator.comparing((UUID id) -> currentByPlayerId.get(id).getBattingOrder()))
                .toList();
        List<UUID> order = new ArrayList<>();
        Iterator<UUID> rest = implied.iterator();
        int position = 1;
        while (!explicit.isEmpty() || rest.hasNext()) {
            if (!explicit.isEmpty() && explicit.firstKey() <= position) {
                order.add(explicit.pollFirstEntry().getValue());
            } else if (rest.hasNext()) {
                order.add(rest.next());
            } else {
                position = explicit.firstKey();
                continue;
            }
            position++;
        }
        return order;
    }

    private SelectionRejectedException rejected(
            Authentication authentication, UUID clubId, List<SelectionRejection> rejections) {
        Map<UUID, Boolean> canReleaseByTeam = new HashMap<>();
        List<SelectionRejectionDto> dtos = rejections.stream()
                .map(rejection -> selectionMapper.toRejectionDto(
                        rejection, takenDto(authentication, clubId, rejection.taken(), canReleaseByTeam)))
                .toList();
        String detail = rejections.size() == 1 && rejections.get(0).playerProfileId() == null
                ? rejections.get(0).message()
                : rejections.size() == 1 ? "1 player can't be selected" : rejections.size() + " players can't be selected";
        return new SelectionRejectedException(detail, dtos);
    }

    private SelectionTakenDto takenDto(
            Authentication authentication, UUID clubId, TakenBy taken, Map<UUID, Boolean> canReleaseByTeam) {
        if (taken == null) {
            return null;
        }
        boolean canRelease = canReleaseByTeam.computeIfAbsent(taken.teamId(), id -> taken.teamClubId().equals(clubId)
                && accessService.canAdministerSection(authentication, clubId, taken.teamSectionId()));
        return selectionMapper.toTakenDto(taken, canRelease);
    }

    private SelectionCoveringPollDto coveringPoll(UUID matchId, MatchPollCoverageService.Coverage coverage) {
        if (coverage.kind() == MatchPollCoverageService.Kind.GROUP) {
            return new SelectionCoveringPollDto(PollCoverageKind.GROUP, coverage.roundId(), coverage.roundId(), matchId);
        }
        if (coverage.kind() == MatchPollCoverageService.Kind.SQUAD) {
            return new SelectionCoveringPollDto(PollCoverageKind.SQUAD, coverage.pollId(), null, matchId);
        }
        return new SelectionCoveringPollDto(PollCoverageKind.NONE, null, null, matchId);
    }

    private boolean isListable(SelectionEligibility.PlayerInfo info, UUID clubId) {
        return info.active() && clubId.equals(info.clubId());
    }

    private boolean matches(SelectionEligibility.PlayerInfo info, String needle) {
        return info.firstName().toLowerCase(Locale.ROOT).contains(needle)
                || info.lastName().toLowerCase(Locale.ROOT).contains(needle);
    }

    private void assertCanAdministerMatch(Authentication authentication, UUID clubId, Match match) {
        Set<UUID> matchSectionIds =
                accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId());
        accessService.assertCanAdministerAnySection(authentication, clubId, matchSectionIds);
    }

    private Match findMatchOrThrowForClub(UUID clubId, UUID matchId) {
        Match match = matchRepository
                .findById(matchId)
                .orElseThrow(() -> new NotFoundException("Match not found: " + matchId));
        if (!match.getClubId().equals(clubId)) {
            throw new NotFoundException("Match not found: " + matchId);
        }
        return match;
    }

    private MatchSide findSideOrThrowForMatch(UUID matchId, UUID sideId) {
        MatchSide side = matchSideRepository
                .findById(sideId)
                .orElseThrow(() -> new NotFoundException("Match side not found: " + sideId));
        if (!side.getMatchId().equals(matchId)) {
            throw new NotFoundException("Match side not found: " + sideId);
        }
        return side;
    }
}
