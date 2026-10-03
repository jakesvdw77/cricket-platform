package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.dto.AddMatchSidePlayerRequest;
import com.cricketlegend.dto.CreateMatchSideRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.PlayerNameDto;
import com.cricketlegend.dto.ReorderMatchSidePlayersRequest;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.dto.UpdateMatchSidePlayerRequest;
import com.cricketlegend.dto.UpdateMatchSideRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayingXiCapExceededException;
import com.cricketlegend.exception.SelectionIncompleteException;
import com.cricketlegend.exception.TwelfthManNotAllowedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchSideMapper;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.service.MatchSideService;
import com.cricketlegend.service.support.SelectionRules;
import com.cricketlegend.service.support.SelectionSideWriter;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules for a match side's selection, per docs/specs/076-team-selection.md (which
 * replaced the squad-membership, cap and twelfth-man rules of docs/specs/029-league-management.md).
 * The rules themselves (limits, pool membership, age, the slot block, the said-unavailable block and
 * the per-player advisory lock) live in {@link SelectionRules}, shared with {@code
 * MatchSelectionServiceImpl}; the row writes (removal, positions kept contiguous) live in {@link
 * SelectionSideWriter}. {@link #addPlayer} order: duplicate (409), total cap (400), then the rules'
 * single rejection for the player (pool/age 400, unavailable/taken 409). {@link #updateSide}
 * requires captain/keeper to be selected and not the twelfth man, and a twelfth man to be allowed
 * by the limits (a not-yet-selected one is added through the same checks). {@link #removePlayer}
 * un-announces unless {@code keepAnnounced}; {@link #reorderPlayers} sets the full batting order;
 * {@link #announce} (docs/specs/040-announce-team.md) names exactly what is missing.
 */
@Service
public class MatchSideServiceImpl implements MatchSideService {

    private static final int NAMES_SHOWN = 3;

    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final SelectionRules selectionRules;
    private final SelectionSideWriter sideWriter;
    private final MatchSideMapper matchSideMapper;
    private final AccessService accessService;

    public MatchSideServiceImpl(
            MatchRepository matchRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            SelectionRules selectionRules,
            SelectionSideWriter sideWriter,
            MatchSideMapper matchSideMapper,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.selectionRules = selectionRules;
        this.sideWriter = sideWriter;
        this.matchSideMapper = matchSideMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MatchSideDto> list(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        SelectionLimitsDto limits = selectionRules.limits(match);
        List<MatchSide> sides = matchSideRepository.findByMatchId(matchId);
        Map<UUID, List<MatchSidePlayer>> rowsBySide = new java.util.HashMap<>();
        for (MatchSide side : sides) {
            rowsBySide.put(side.getId(), matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(side.getId()));
        }
        Map<UUID, PlayerNameDto> info = selectionRules.playerInfo(rowsBySide.values().stream()
                .flatMap(List::stream)
                .map(MatchSidePlayer::getPlayerProfileId)
                .toList());
        return sides.stream()
                .map(side -> matchSideMapper.toDto(side, rowsBySide.get(side.getId()), limits, info))
                .toList();
    }

    @Override
    @Transactional
    public MatchSideDto createSide(
            Authentication authentication, UUID clubId, UUID matchId, CreateMatchSideRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        UUID teamId = request.teamId();

        boolean isHome = teamId.equals(match.getHomeTeamId());
        boolean isAway = teamId.equals(match.getAwayTeamId());
        if (!isHome && !isAway) {
            throw new ValidationException(
                    "teamId " + teamId + " is not one of this match's own home/away team ids");
        }
        if (matchSideRepository.existsByMatchIdAndTeamId(matchId, teamId)) {
            throw new ConflictException("A side for team " + teamId + " already exists on match " + matchId);
        }

        MatchSide side = MatchSide.builder().matchId(matchId).teamId(teamId).build();
        side = matchSideRepository.save(side);

        return toDto(side, selectionRules.limits(match));
    }

    @Override
    @Transactional
    public MatchSideDto updateSide(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, UpdateMatchSideRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        UUID captainId = request.captainPlayerId();
        UUID keeperId = request.wicketKeeperPlayerId();
        UUID twelfthId = request.twelfthManPlayerId();
        if (twelfthId != null && (twelfthId.equals(captainId) || twelfthId.equals(keeperId))) {
            throw new ValidationException(
                    "twelfthManPlayerId " + twelfthId + " cannot also be the captain or the wicketkeeper");
        }
        List<MatchSidePlayer> rows = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId);
        Map<UUID, MatchSidePlayer> byPlayerId =
                rows.stream().collect(Collectors.toMap(MatchSidePlayer::getPlayerProfileId, row -> row));
        if (captainId != null && !byPlayerId.containsKey(captainId)) {
            throw new ValidationException("captainPlayerId " + captainId + " is not in this side's selection");
        }
        if (keeperId != null && !byPlayerId.containsKey(keeperId)) {
            throw new ValidationException(
                    "wicketKeeperPlayerId " + keeperId + " is not in this side's selection");
        }

        SelectionLimitsDto limits = selectionRules.limits(match);
        if (twelfthId != null) {
            if (!twelfthId.equals(side.getTwelfthManPlayerId()) && !limits.twelfthManAllowed()) {
                throw new TwelfthManNotAllowedException(
                        "This match has no 12th man place: the league's playing conditions do not allow one");
            }
            MatchSidePlayer existing = byPlayerId.get(twelfthId);
            if (existing == null) {
                selectionRules.lockPlayers(Set.of(twelfthId));
                requireRoom(rows.size(), limits);
                selectionRules.requireSelectable(match, side.getTeamId(), twelfthId);
                sideWriter.addPlayer(sideId, twelfthId, PlayingRole.BATSMAN, null);
            } else if (existing.getBattingOrder() != null) {
                sideWriter.assignOrder(sideId, sideWriter.positionedPlayerIds(sideId, Set.of(twelfthId)));
            }
        }

        side.setCaptainPlayerId(captainId);
        side.setWicketKeeperPlayerId(keeperId);
        side.setTwelfthManPlayerId(twelfthId);
        if (side.isAnnounced()) {
            side.setAnnounced(false);
        }
        side = matchSideRepository.save(side);

        return toDto(side, limits);
    }

    @Override
    @Transactional
    public MatchSideDto addPlayer(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, AddMatchSidePlayerRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);
        UUID playerId = request.playerProfileId();

        selectionRules.lockPlayers(Set.of(playerId));
        if (matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(sideId, playerId)) {
            throw new ConflictException("Player " + playerId + " is already added to side " + sideId);
        }
        SelectionLimitsDto limits = selectionRules.limits(match);
        List<MatchSidePlayer> rows = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId);
        requireRoom(rows.size(), limits);
        selectionRules.requireSelectable(match, side.getTeamId(), playerId);

        int positioned = (int) rows.stream().filter(row -> row.getBattingOrder() != null).count();
        int highest = rows.stream().filter(row -> row.getBattingOrder() != null)
                .mapToInt(MatchSidePlayer::getBattingOrder).max().orElse(0);
        Integer position = positioned < limits.battingPlaces() ? highest + 1 : null;
        sideWriter.addPlayer(sideId, playerId, request.role(), position);

        if (side.isAnnounced()) {
            side.setAnnounced(false);
            side = matchSideRepository.save(side);
        }

        return toDto(side, limits);
    }

    @Override
    @Transactional
    public MatchSideDto updatePlayerRole(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID sideId,
            UUID playerProfileId,
            UpdateMatchSidePlayerRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        MatchSidePlayer player = matchSidePlayerRepository
                .findByMatchSideIdAndPlayerProfileId(sideId, playerProfileId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerProfileId + " is not on side " + sideId));
        player.setRole(request.role());
        matchSidePlayerRepository.save(player);

        if (side.isAnnounced()) {
            side.setAnnounced(false);
            side = matchSideRepository.save(side);
        }

        return toDto(side, selectionRules.limits(match));
    }

    @Override
    @Transactional
    public MatchSideDto removePlayer(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID sideId,
            UUID playerProfileId,
            boolean keepAnnounced) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        matchSidePlayerRepository
                .findByMatchSideIdAndPlayerProfileId(sideId, playerProfileId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerProfileId + " is not on side " + sideId));
        UUID captainBefore = side.getCaptainPlayerId();
        UUID keeperBefore = side.getWicketKeeperPlayerId();
        UUID twelfthBefore = side.getTwelfthManPlayerId();
        sideWriter.removePlayers(side, List.of(playerProfileId));
        sideWriter.compact(sideId);

        boolean unannounce = side.isAnnounced() && !keepAnnounced;
        if (unannounce) {
            side.setAnnounced(false);
        }
        if (unannounce
                || !Objects.equals(captainBefore, side.getCaptainPlayerId())
                || !Objects.equals(keeperBefore, side.getWicketKeeperPlayerId())
                || !Objects.equals(twelfthBefore, side.getTwelfthManPlayerId())) {
            side = matchSideRepository.save(side);
        }

        return toDto(side, selectionRules.limits(match));
    }

    @Override
    @Transactional
    public MatchSideDto reorderPlayers(
            Authentication authentication,
            UUID clubId,
            UUID matchId,
            UUID sideId,
            ReorderMatchSidePlayersRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);
        SelectionLimitsDto limits = selectionRules.limits(match);

        List<UUID> requested = request.playerProfileIds();
        if (new HashSet<>(requested).size() != requested.size()) {
            throw new ValidationException("playerProfileIds must not contain the same player twice");
        }
        Set<UUID> selectedIds = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId).stream()
                .map(MatchSidePlayer::getPlayerProfileId)
                .collect(Collectors.toSet());
        if (!selectedIds.containsAll(requested)) {
            throw new ValidationException("playerProfileIds must all be players selected on this side");
        }
        if (requested.size() > limits.battingPlaces()) {
            throw new ValidationException("A batting order holds at most " + limits.battingPlaces() + " players");
        }

        sideWriter.assignOrder(sideId, requested);
        boolean changed = false;
        if (side.getTwelfthManPlayerId() != null && requested.contains(side.getTwelfthManPlayerId())) {
            side.setTwelfthManPlayerId(null);
            changed = true;
        }
        if (side.isAnnounced()) {
            side.setAnnounced(false);
            changed = true;
        }
        if (changed) {
            side = matchSideRepository.save(side);
        }

        return toDto(side, limits);
    }

    @Override
    @Transactional
    public MatchSideDto announce(Authentication authentication, UUID clubId, UUID matchId, UUID sideId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);
        SelectionLimitsDto limits = selectionRules.limits(match);

        List<MatchSidePlayer> rows = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId);
        if (rows.isEmpty()) {
            throw new ValidationException("Side " + sideId + " has no players to announce");
        }
        requireAnnounceable(side, rows, limits);

        side.setAnnounced(true);
        side = matchSideRepository.save(side);

        return toDto(side, limits);
    }

    @Override
    @Transactional
    public MatchSideDto unannounce(Authentication authentication, UUID clubId, UUID matchId, UUID sideId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        side.setAnnounced(false);
        side = matchSideRepository.save(side);

        return toDto(side, selectionRules.limits(match));
    }

    private void requireRoom(int currentCount, SelectionLimitsDto limits) {
        if (currentCount >= limits.maxSelected()) {
            throw new PlayingXiCapExceededException(
                    "Team is full: " + limits.maxSelected() + " is the most that can be selected");
        }
    }

    /**
     * Section 8 of docs/specs/076-team-selection.md: at most {@code maxSelected} players, every
     * selected player other than the 12th man has a batting position, and no more than {@code
     * battingPlaces} do. The message names exactly what is missing.
     */
    private void requireAnnounceable(MatchSide side, List<MatchSidePlayer> rows, SelectionLimitsDto limits) {
        String prefix = "Cannot announce " + selectionRules.team(side.getTeamId()).getName() + ": ";
        if (rows.size() > limits.maxSelected()) {
            throw new SelectionIncompleteException(prefix + rows.size() + " players are selected; the most allowed is "
                    + limits.maxSelected() + ".");
        }
        List<UUID> unpositioned = rows.stream()
                .filter(row -> row.getBattingOrder() == null)
                .map(MatchSidePlayer::getPlayerProfileId)
                .filter(id -> !id.equals(side.getTwelfthManPlayerId()))
                .toList();
        if (!unpositioned.isEmpty()) {
            int count = unpositioned.size();
            throw new SelectionIncompleteException(prefix + count + (count == 1 ? " player has" : " players have")
                    + " no batting position (" + nameList(unpositioned) + ").");
        }
        long positioned = rows.stream().filter(row -> row.getBattingOrder() != null).count();
        if (positioned > limits.battingPlaces()) {
            throw new SelectionIncompleteException(prefix + positioned + " players are selected but only "
                    + limits.battingPlaces() + " places exist; choose the 12th man or remove one.");
        }
    }

    private String nameList(List<UUID> playerIds) {
        List<String> names = selectionRules.playerNames(playerIds).values().stream().sorted().toList();
        if (names.size() <= NAMES_SHOWN) {
            return String.join(", ", names);
        }
        return String.join(", ", names.subList(0, NAMES_SHOWN)) + " and " + (names.size() - NAMES_SHOWN) + " more";
    }

    private MatchSideDto toDto(MatchSide side, SelectionLimitsDto limits) {
        List<MatchSidePlayer> players =
                matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(side.getId());
        return matchSideMapper.toDto(side, players, limits, selectionRules.playerInfo(
                players.stream().map(MatchSidePlayer::getPlayerProfileId).toList()));
    }

    /**
     * Per docs/specs/035-section-scoped-access.md: a section-scoped caller builds only their own
     * section's side of a match, resolved via the shared {@link
     * AccessService#resolveMatchSectionIds} helper (the side's own {@code teamId} is already
     * constrained to equal one of the match's own team ids per 029).
     */
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
