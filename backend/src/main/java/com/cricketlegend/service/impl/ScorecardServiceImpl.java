package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.BattingEntry;
import com.cricketlegend.domain.BowlingEntry;
import com.cricketlegend.domain.CreditSource;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.FeaturedOverride;
import com.cricketlegend.domain.FieldingEntry;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAward;
import com.cricketlegend.domain.MatchInnings;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultIssueSeverity;
import com.cricketlegend.domain.ResultPlayer;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.domain.ScorecardSelectionState;
import com.cricketlegend.domain.ScorecardStatus;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.FieldingEntryDto;
import com.cricketlegend.dto.GuestNameDto;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.OppositionNameDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultIssueDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.dto.ScorecardPrefillDto;
import com.cricketlegend.dto.ScorecardSideStatusDto;
import com.cricketlegend.exception.InvalidResultException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.OppositionPlayerNotLinkableException;
import com.cricketlegend.exception.PlayerAlreadyInResultException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ScorecardMapper;
import com.cricketlegend.repository.BattingEntryRepository;
import com.cricketlegend.repository.BowlingEntryRepository;
import com.cricketlegend.repository.FieldingEntryRepository;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.MatchAwardRepository;
import com.cricketlegend.repository.MatchInningsRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PlayerNameView;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.ResultPlayerRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.ScorecardService;
import com.cricketlegend.service.support.DismissalCredits;
import com.cricketlegend.service.support.DismissalCredits.Credit;
import com.cricketlegend.service.support.DismissalCredits.Dismissal;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.service.support.ScorecardRows;
import com.cricketlegend.service.support.SelectionEligibility;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import com.cricketlegend.service.support.ScorecardContext;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.service.support.StandoutRules;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/101-match-results-our-side-scorecard.md. The scorecard (ours and, as typed names, the opposition's) hangs
 * off the result's regular innings (which the result upsert reconciles in place, so rows survive a re-save). A whole-scorecard save deletes the entries and the
 * awards, reconciles the players by id (so a swap or a link stays one row) and re-inserts the entries, all inside the
 * result's own transaction, then recomputes what the dismissals decide (the non-bowler wickets of an innings with batting
 * entries, DERIVED bowling and fielding rows) with {@link DismissalCredits}. Standout suggestions are computed on every
 * read by {@link StandoutRules} for our players only; only the manager's override is stored on a draft, and the
 * effective value is frozen at publish.
 */
@Service
public class ScorecardServiceImpl implements ScorecardService {

    private final MatchService matchService;
    private final MatchResultRepository resultRepository;
    private final MatchInningsRepository inningsRepository;
    private final ResultPlayerRepository playerRepository;
    private final BattingEntryRepository battingRepository;
    private final BowlingEntryRepository bowlingRepository;
    private final FieldingEntryRepository fieldingRepository;
    private final MatchAwardRepository awardRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final TeamRepository teamRepository;
    private final TeamSquadMemberRepository squadRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final LeaguePlayingConditionsRepository playingConditionsRepository;
    private final SelectionEligibility eligibility;
    private final ScorecardMapper mapper;
    private final AccessService accessService;

    public ScorecardServiceImpl(
            MatchService matchService,
            MatchResultRepository resultRepository,
            MatchInningsRepository inningsRepository,
            ResultPlayerRepository playerRepository,
            BattingEntryRepository battingRepository,
            BowlingEntryRepository bowlingRepository,
            FieldingEntryRepository fieldingRepository,
            MatchAwardRepository awardRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            TeamRepository teamRepository,
            TeamSquadMemberRepository squadRepository,
            PlayerProfileRepository playerProfileRepository,
            LeaguePlayingConditionsRepository playingConditionsRepository,
            SelectionEligibility eligibility,
            ScorecardMapper mapper,
            AccessService accessService) {
        this.matchService = matchService;
        this.resultRepository = resultRepository;
        this.inningsRepository = inningsRepository;
        this.playerRepository = playerRepository;
        this.battingRepository = battingRepository;
        this.bowlingRepository = bowlingRepository;
        this.fieldingRepository = fieldingRepository;
        this.awardRepository = awardRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.teamRepository = teamRepository;
        this.squadRepository = squadRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.playingConditionsRepository = playingConditionsRepository;
        this.eligibility = eligibility;
        this.mapper = mapper;
        this.accessService = accessService;
    }

    // ---- prefill ----

    @Override
    @Transactional(readOnly = true)
    public ScorecardPrefillDto prefill(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = matchService.requireAdministrableMatch(authentication, clubId, matchId);
        Map<UUID, MatchSide> sidesByTeam = matchSideRepository.findByMatchId(matchId).stream()
                .collect(Collectors.toMap(MatchSide::getTeamId, side -> side, (a, b) -> a));
        Map<ResultSide, UUID> ours = oursSides(match);
        Map<UUID, Team> teams = ours.isEmpty()
                ? Map.of()
                : teamRepository.findAllById(ours.values()).stream().collect(Collectors.toMap(Team::getId, t -> t));
        Map<ResultSide, List<MatchSidePlayer>> selected = new HashMap<>();
        Set<UUID> profileIds = new HashSet<>();
        ours.forEach((side, teamId) -> {
            MatchSide matchSide = sidesByTeam.get(teamId);
            List<MatchSidePlayer> players = matchSide == null
                    ? List.of()
                    : matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId()).stream()
                            .sorted(Comparator.comparing(MatchSidePlayer::getBattingOrder,
                                    Comparator.nullsLast(Comparator.naturalOrder())))
                            .toList();
            selected.put(side, players);
            players.forEach(p -> profileIds.add(p.getPlayerProfileId()));
            if (matchSide != null && matchSide.getTwelfthManPlayerId() != null) {
                profileIds.add(matchSide.getTwelfthManPlayerId());
            }
        });
        Map<UUID, PlayerInfo> names = eligibility.loadPlayers(profileIds);
        List<ScorecardPrefillDto.Side> sides = new ArrayList<>();
        for (ResultSide side : ResultSide.values()) {
            UUID teamId = ours.get(side);
            if (teamId == null) {
                continue;
            }
            List<ScorecardPrefillDto.Player> players = new ArrayList<>();
            MatchSide matchSide = sidesByTeam.get(teamId);
            UUID twelfth = matchSide == null ? null : matchSide.getTwelfthManPlayerId();
            Set<UUID> listed = new HashSet<>();
            for (MatchSidePlayer p : selected.getOrDefault(side, List.of())) {
                if (!listed.add(p.getPlayerProfileId())) {
                    continue;
                }
                PlayerInfo info = names.get(p.getPlayerProfileId());
                boolean isTwelfth = p.getPlayerProfileId().equals(twelfth);
                players.add(new ScorecardPrefillDto.Player(
                        p.getPlayerProfileId(), info == null ? null : info.firstName(),
                        info == null ? null : info.lastName(), isTwelfth ? null : p.getBattingOrder(), p.getRole(),
                        isTwelfth));
            }
            if (twelfth != null && !listed.contains(twelfth)) {
                PlayerInfo info = names.get(matchSide.getTwelfthManPlayerId());
                players.add(new ScorecardPrefillDto.Player(
                        matchSide.getTwelfthManPlayerId(), info == null ? null : info.firstName(),
                        info == null ? null : info.lastName(), null, null, true));
            }
            Team team = teams.get(teamId);
            sides.add(new ScorecardPrefillDto.Side(side, teamId, team == null ? null : team.getName(), players,
                    selectionState(matchSide, !selected.getOrDefault(side, List.of()).isEmpty())));
        }
        return new ScorecardPrefillDto(sides);
    }

    // ---- reads ----

    @Override
    @Transactional(readOnly = true)
    public ScorecardDto read(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = matchService.requireAdministrableMatch(authentication, clubId, matchId);
        MatchResult result = resultRepository
                .findByMatchId(matchId)
                .orElseThrow(() -> new NotFoundException("No result for match: " + matchId));
        return build(result, match);
    }

    @Override
    @Transactional(readOnly = true)
    public ScorecardDto load(UUID matchResultId, Match match) {
        MatchResult result = resultRepository
                .findById(matchResultId)
                .orElseThrow(() -> new NotFoundException("No result: " + matchResultId));
        return build(result, match);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> playersOfTheMatch(Collection<UUID> matchResultIds) {
        Map<UUID, String> byResult = new HashMap<>();
        if (matchResultIds.isEmpty()) {
            return byResult;
        }
        List<MatchAward> official = awardRepository.findByMatchResultIdIn(matchResultIds).stream()
                .filter(a -> a.getAwardType() == AwardType.PLAYER_OF_MATCH)
                .toList();
        Map<UUID, ResultPlayer> players = playerRepository
                .findAllById(official.stream().map(MatchAward::getResultPlayerId).filter(Objects::nonNull).toList())
                .stream()
                .collect(Collectors.toMap(ResultPlayer::getId, p -> p));
        Map<UUID, PlayerInfo> names = eligibility.loadPlayers(players.values().stream()
                .map(ResultPlayer::getPlayerProfileId).filter(Objects::nonNull).collect(Collectors.toSet()));
        for (MatchAward award : official) {
            ResultPlayer player = award.getResultPlayerId() == null ? null : players.get(award.getResultPlayerId());
            String name = player != null ? nameOf(player, names) : award.getDisplayName();
            if (name != null && !name.isBlank()) {
                byResult.put(award.getMatchResultId(), name);
            }
        }
        return byResult;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<GuestNameDto> guestNames(
            Authentication authentication, UUID clubId, UUID teamId, String q, Pageable pageable) {
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        String filter = q == null ? "" : q.trim();
        Optional<Set<UUID>> scope = authorizedTeamIds(authentication, clubId, teamId);
        if (scope.isPresent() && scope.get().isEmpty()) {
            return Page.empty(pageable);
        }
        return playerRepository
                .findGuestNames(
                        clubId, teamId == null, teamId == null ? new UUID(0, 0) : teamId,
                        scope.isPresent(), scope.orElse(Set.of(new UUID(0, 0))), filter, unsorted)
                .map(v -> new GuestNameDto(v.getDisplayName(), v.getUses(), v.getLastUsed()));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<OppositionNameDto> oppositionNames(
            Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID leagueTeamId, String opposition,
            String q, Pageable pageable) {
        UUID leagueTeam = leagueTeamId;
        String name = opposition;
        Optional<Set<UUID>> scope = authorizedTeamIds(authentication, clubId, teamId);
        Set<String> excluded = new HashSet<>();
        if (matchId != null) {
            Match match = matchService.requireAdministrableMatch(authentication, clubId, matchId);
            if (leagueTeam == null && (name == null || name.isBlank())) {
                if (match.getHomeTeamId() == null) {
                    leagueTeam = match.getHomeLeagueTeamId();
                    name = match.getHomeTeamName();
                } else if (match.getAwayTeamId() == null) {
                    leagueTeam = match.getAwayLeagueTeamId();
                    name = match.getAwayTeamName();
                }
            }
            resultRepository.findByMatchId(matchId).ifPresent(result -> playerRepository
                    .findByMatchResultIdOrderByCreatedAtAscIdAsc(result.getId()).stream()
                    .filter(ResultPlayer::isOpposition)
                    .forEach(p -> excluded.add(ScorecardContext.normalise(p.getDisplayName()))));
        }
        String normalisedName = ScorecardContext.normalise(name);
        if ((leagueTeam == null && normalisedName.isEmpty()) || (scope.isPresent() && scope.get().isEmpty())) {
            return Page.empty(pageable);
        }
        excluded.add("<none>"); // never empty: an empty IN list is not valid SQL
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        return playerRepository
                .findOppositionNames(
                        clubId, teamId == null, teamId == null ? new UUID(0, 0) : teamId,
                        scope.isPresent(), scope.orElse(Set.of(new UUID(0, 0))), leagueTeam != null,
                        leagueTeam == null ? new UUID(0, 0) : leagueTeam, normalisedName, excluded,
                        q == null ? "" : q.trim(), unsorted)
                .map(v -> new OppositionNameDto(v.getDisplayName(), v.getUses(), v.getLastMatchDate()));
    }

    /**
     * The teams whose fixtures the caller may read names from: empty Optional for a club-wide caller, else the club's
     * teams in the caller's accessible sections (possibly none). A given {@code teamId} must be a team of this club in
     * a section the caller can administer, else 404 / 403.
     */
    private Optional<Set<UUID>> authorizedTeamIds(Authentication authentication, UUID clubId, UUID teamId) {
        if (teamId != null) {
            Team team = teamRepository
                    .findById(teamId)
                    .filter(t -> clubId.equals(t.getClubId()))
                    .orElseThrow(() -> new NotFoundException("Team not found: " + teamId));
            accessService.assertCanAdministerSection(authentication, clubId, team.getSectionId());
        }
        return accessService.accessibleSectionIds(authentication, clubId).map(sections -> teamRepository
                .findByClubId(clubId).stream()
                .filter(t -> sections.contains(t.getSectionId()))
                .map(Team::getId)
                .collect(Collectors.toSet()));
    }

    // ---- writes ----

    @Override
    @Transactional
    public void replace(UUID matchResultId, UUID clubId, Match match, ScorecardDto scorecard, UUID updatedBy) {
        Map<ResultSide, UUID> ours = oursSides(match);
        checkSides(scorecard, ours);
        checkProfilesBelongToClub(scorecard, clubId);

        List<MatchInnings> innings = inningsRepository.findByMatchResultIdOrderBySequence(matchResultId);
        Map<ResultSide, UUID> regularBySide = new HashMap<>();
        innings.stream()
                .filter(i -> i.getKind() == InningsKind.REGULAR)
                .forEach(i -> regularBySide.putIfAbsent(i.getBattingSide(), i.getId()));
        List<UUID> inningsIds = innings.stream().map(MatchInnings::getId).toList();

        awardRepository.deleteByMatchResultId(matchResultId);
        if (!inningsIds.isEmpty()) {
            battingRepository.deleteByMatchInningsIdIn(inningsIds);
            bowlingRepository.deleteByMatchInningsIdIn(inningsIds);
            fieldingRepository.deleteByMatchInningsIdIn(inningsIds);
        }

        Map<UUID, ResultPlayer> existing = playerRepository
                .findByMatchResultIdOrderByCreatedAtAscIdAsc(matchResultId).stream()
                .collect(Collectors.toMap(ResultPlayer::getId, p -> p));
        Set<UUID> keptIds = scorecard.players().stream()
                .map(ResultPlayerDto::id).filter(Objects::nonNull).collect(Collectors.toSet());
        List<ResultPlayer> removed = existing.values().stream().filter(p -> !keptIds.contains(p.getId())).toList();
        if (!removed.isEmpty()) {
            playerRepository.deleteAll(removed);
            playerRepository.flush();
        }

        Map<String, UUID> playerIdByRef = new HashMap<>();
        List<ResultPlayer> saved = new ArrayList<>();
        for (ResultPlayerDto dto : scorecard.players()) {
            ResultPlayer player;
            if (dto.id() != null) {
                player = existing.get(dto.id());
                if (player == null) {
                    throw reject(ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.TEAMS, dto.side(),
                            "A player on the scorecard does not belong to this result.");
                }
                mapper.applyPlayer(dto, player);
            } else {
                player = mapper.toPlayerEntity(dto);
                player.setMatchResultId(matchResultId);
            }
            player.setDisplayName(dto.displayName() == null || dto.displayName().isBlank()
                    ? null : dto.displayName().trim());
            player.setUpdatedBy(updatedBy);
            saved.add(player);
        }
        List<ResultPlayer> persisted = playerRepository.saveAll(saved);
        playerRepository.flush();
        for (int index = 0; index < persisted.size(); index++) {
            ResultPlayerDto dto = scorecard.players().get(index);
            UUID id = persisted.get(index).getId();
            if (dto.id() != null) {
                playerIdByRef.put(dto.id().toString(), id);
            }
            if (dto.clientKey() != null && !dto.clientKey().isBlank()) {
                playerIdByRef.put(dto.clientKey(), id);
            }
        }

        List<BattingEntry> batting = new ArrayList<>();
        for (BattingEntryDto dto : scorecard.batting()) {
            BattingEntry entry = mapper.toBattingEntity(
                    dto, regularBySide.get(dto.battingSide()),
                    resolve(playerIdByRef, dto.resultPlayerId(), dto.playerClientKey()),
                    resolveOptional(playerIdByRef, dto.bowlerPlayerId()),
                    resolveOptional(playerIdByRef, dto.fielderPlayerId()));
            if (entry.getHowOut() == DismissalType.DID_NOT_BAT) {
                entry.setPosition(null);
            }
            batting.add(entry);
        }
        List<BowlingEntry> bowling = scorecard.bowling().stream()
                .map(dto -> mapper.toBowlingEntity(dto, regularBySide.get(dto.battingSide()),
                        resolve(playerIdByRef, dto.resultPlayerId(), dto.playerClientKey())))
                .collect(Collectors.toCollection(ArrayList::new));
        List<FieldingEntry> fielding = scorecard.fielding().stream()
                .map(dto -> mapper.toFieldingEntity(dto, regularBySide.get(dto.battingSide()),
                        resolve(playerIdByRef, dto.resultPlayerId(), dto.playerClientKey())))
                .collect(Collectors.toCollection(ArrayList::new));
        List<MatchInnings> regular = innings.stream().filter(i -> i.getKind() == InningsKind.REGULAR).toList();
        fielding = recomputeFromDismissals(regular, batting, bowling, fielding);
        inningsRepository.saveAll(regular);
        battingRepository.saveAll(batting);
        bowlingRepository.saveAll(bowling);
        fieldingRepository.saveAll(fielding);

        Map<UUID, ResultPlayer> playersById = persisted.stream().collect(Collectors.toMap(ResultPlayer::getId, p -> p));
        Map<UUID, PlayerInfo> infos = eligibility.loadPlayers(persisted.stream()
                .map(ResultPlayer::getPlayerProfileId).filter(Objects::nonNull).collect(Collectors.toSet()));
        List<MatchAward> awards = new ArrayList<>();
        for (MatchAwardDto dto : scorecard.awards()) {
            if (dto.awardType() == AwardType.TEAM_PLAYER_OF_MATCH && !ours.containsKey(dto.side())) {
                throw reject(ErrorCode.AWARD_SIDE_NOT_OURS, ResultWizardStep.AWARDS, dto.side(),
                        "A team player of the match can only be given for one of our own sides.");
            }
            UUID playerId = dto.resultPlayerId() == null && (dto.playerClientKey() == null || dto.playerClientKey().isBlank())
                    ? null
                    : resolve(playerIdByRef, dto.resultPlayerId(), dto.playerClientKey());
            MatchAward award = mapper.toAwardEntity(dto, matchResultId, playerId);
            ResultPlayer awarded = playerId == null ? null : playersById.get(playerId);
            if (awarded != null) {
                // the name is always copied and refreshed, so the award keeps it if an opposition row is removed later
                award.setDisplayName(nameOf(awarded, infos));
                if (dto.awardType() == AwardType.PLAYER_OF_MATCH) {
                    award.setSide(awarded.getSide());
                }
            } else {
                award.setDisplayName(dto.displayName() == null || dto.displayName().isBlank()
                        ? null : dto.displayName().trim());
            }
            awards.add(award);
        }
        awardRepository.saveAll(awards);
        awardRepository.flush();
    }

    /**
     * Writes what the dismissals decide, per innings that has batting entries: its non-bowler wickets, the wickets of
     * every DERIVED bowling row and the credits of every DERIVED fielding row (a DERIVED fielding row whose credits fall
     * to zero is dropped, and one is added for a fielder the dismissals credit who has no row). MANUAL rows are never
     * touched. An innings without batting entries has nothing to derive from, so its rows keep their values. Returns
     * the fielding rows to store.
     */
    private List<FieldingEntry> recomputeFromDismissals(
            List<MatchInnings> regular, List<BattingEntry> batting, List<BowlingEntry> bowling,
            List<FieldingEntry> fielding) {
        List<FieldingEntry> stored = new ArrayList<>();
        Set<UUID> derivedInnings = new HashSet<>();
        for (MatchInnings innings : regular) {
            List<BattingEntry> batters = batting.stream()
                    .filter(e -> innings.getId().equals(e.getMatchInningsId())).toList();
            if (batters.isEmpty()) {
                continue;
            }
            derivedInnings.add(innings.getId());
            innings.setNonBowlerWickets(
                    (int) batters.stream().filter(e -> e.getHowOut() != null && e.getHowOut().isNonBowlerWicket()).count());
            Map<UUID, Credit> credits = DismissalCredits.derive(batters.stream()
                    .map(e -> new Dismissal<>(e.getHowOut(), e.getBowlerResultPlayerId(), e.getFielderResultPlayerId()))
                    .toList());
            bowling.stream()
                    .filter(b -> innings.getId().equals(b.getMatchInningsId()) && b.getWicketsSource() == CreditSource.DERIVED)
                    .forEach(b -> b.setWickets(credits.getOrDefault(b.getResultPlayerId(), Credit.NONE).wickets()));
            Set<UUID> withRow = new HashSet<>();
            for (FieldingEntry f : fielding) {
                if (!innings.getId().equals(f.getMatchInningsId())) {
                    continue;
                }
                withRow.add(f.getResultPlayerId());
                if (f.getCreditsSource() == CreditSource.DERIVED) {
                    Credit c = credits.getOrDefault(f.getResultPlayerId(), Credit.NONE);
                    f.setCatches(c.catches());
                    f.setStumpings(c.stumpings());
                    f.setRunOuts(c.runOuts());
                }
            }
            credits.forEach((playerId, c) -> {
                if (c.hasFielding() && !withRow.contains(playerId)) {
                    stored.add(FieldingEntry.builder()
                            .matchInningsId(innings.getId()).resultPlayerId(playerId)
                            .catches(c.catches()).stumpings(c.stumpings()).runOuts(c.runOuts())
                            .creditsSource(CreditSource.DERIVED).build());
                }
            });
        }
        for (FieldingEntry f : fielding) {
            boolean empty = f.getCatches() == 0 && f.getStumpings() == 0 && f.getRunOuts() == 0;
            if (!(f.getCreditsSource() == CreditSource.DERIVED && derivedInnings.contains(f.getMatchInningsId()) && empty)) {
                stored.add(f);
            }
        }
        return stored;
    }

    @Override
    @Transactional
    public void refreshNonBowlerWickets(UUID matchResultId) {
        ScorecardRows loaded = load(matchResultId);
        for (MatchInnings innings : loaded.innings()) {
            List<BattingEntry> batters = loaded.batting().stream()
                    .filter(e -> innings.getId().equals(e.getMatchInningsId())).toList();
            if (!batters.isEmpty()) {
                innings.setNonBowlerWickets(
                        (int) batters.stream().filter(e -> e.getHowOut() != null && e.getHowOut().isNonBowlerWicket()).count());
            }
        }
        inningsRepository.saveAll(loaded.innings());
    }

    @Override
    @Transactional
    public ResultPlayerDto link(
            Authentication authentication, UUID clubId, UUID matchId, UUID resultPlayerId, UUID playerProfileId) {
        matchService.requireAdministrableMatch(authentication, clubId, matchId);
        MatchResult result = resultRepository
                .findByMatchId(matchId)
                .orElseThrow(() -> new NotFoundException("No result for match: " + matchId));
        ResultPlayer player = playerRepository
                .findById(resultPlayerId)
                .filter(p -> p.getMatchResultId().equals(result.getId()))
                .orElseThrow(() -> new NotFoundException("No such player on this result: " + resultPlayerId));
        if (player.isOpposition()) {
            throw new OppositionPlayerNotLinkableException(
                    "An opposition player is a name only and cannot be linked to a registered player.");
        }
        if (player.getPlayerProfileId() != null) {
            throw new ValidationException("This player is already linked to a registered player.");
        }
        PlayerProfile profile = playerProfileRepository
                .findById(playerProfileId)
                .filter(p -> p.getClubId().equals(clubId))
                .orElseThrow(() -> new ValidationException("That player does not belong to this club."));
        boolean alreadyOnSide = playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(result.getId()).stream()
                .anyMatch(p -> p.getSide() == player.getSide() && profile.getId().equals(p.getPlayerProfileId()));
        if (alreadyOnSide) {
            throw new PlayerAlreadyInResultException("That player is already on the scorecard for this side.");
        }
        UUID person = accessService.resolveCurrentPersonId(authentication);
        player.setPlayerProfileId(profile.getId());
        player.setLinkedBy(person);
        player.setLinkedAt(ServerClock.now());
        player.setUpdatedBy(person);
        ResultPlayer saved = playerRepository.saveAndFlush(player);
        PlayerInfo info = eligibility.loadPlayers(List.of(profile.getId())).get(profile.getId());
        return mapper.toPlayerDto(saved, info == null ? null : info.firstName(), info == null ? null : info.lastName());
    }

    @Override
    @Transactional
    public void freezeFeatured(UUID matchResultId, Match match) {
        ScorecardRows loaded = load(matchResultId);
        Set<UUID> suggested = suggestions(loaded);
        Set<UUID> opposition = oppositionPlayerIds(loaded);
        loaded.batting().forEach(e -> e.setFeatured(opposition.contains(e.getResultPlayerId()) ? null
                : effective(e.getFeaturedOverride(), suggested.contains(e.getId()), canBeFeatured(e))));
        loaded.bowling().forEach(e -> e.setFeatured(opposition.contains(e.getResultPlayerId()) ? null
                : effective(e.getFeaturedOverride(), suggested.contains(e.getId()), canBeFeatured(e))));
        loaded.fielding().forEach(e -> e.setFeatured(opposition.contains(e.getResultPlayerId()) ? null
                : effective(e.getFeaturedOverride(), suggested.contains(e.getId()), true)));
        battingRepository.saveAll(loaded.batting());
        bowlingRepository.saveAll(loaded.bowling());
        fieldingRepository.saveAll(loaded.fielding());
    }

    @Override
    @Transactional
    public void clearFeatured(UUID matchResultId) {
        ScorecardRows loaded = load(matchResultId);
        loaded.batting().forEach(e -> e.setFeatured(null));
        loaded.bowling().forEach(e -> e.setFeatured(null));
        loaded.fielding().forEach(e -> e.setFeatured(null));
        battingRepository.saveAll(loaded.batting());
        bowlingRepository.saveAll(loaded.bowling());
        fieldingRepository.saveAll(loaded.fielding());
    }

    // ---- validation context ----

    @Override
    @Transactional(readOnly = true)
    public ScorecardContext validationContext(Match match, ResultDraft draft) {
        ScorecardDto scorecard = draft.scorecard();
        if (scorecard == null || scorecard.isEmpty()) {
            return ScorecardContext.none();
        }
        Integer maxBalls = null;
        if (match.getLeagueId() != null) {
            maxBalls = playingConditionsRepository
                    .findByLeagueIdAndSeasonId(match.getLeagueId(), match.getSeasonId())
                    .map(LeaguePlayingConditions::getMaxOversPerBowler)
                    .filter(Objects::nonNull)
                    .map(overs -> overs * draft.ballsPerOver())
                    .orElse(null);
        }
        Map<ResultSide, Set<UUID>> squads = new HashMap<>();
        oursSides(match).forEach((side, teamId) -> {
            Set<UUID> squad = squadRepository.findByTeamIdAndSeasonId(teamId, match.getSeasonId()).stream()
                    .map(m -> m.getPlayerProfileId()).collect(Collectors.toSet());
            if (!squad.isEmpty()) {
                squads.put(side, squad);
            }
        });
        Map<String, UUID> registered = new HashMap<>();
        if (scorecard.players().stream().anyMatch(p -> p.playerProfileId() == null && !p.opposition())) {
            for (PlayerNameView view : playerProfileRepository.findActiveNamesByClubId(match.getClubId())) {
                registered.putIfAbsent(
                        ScorecardContext.normalise(view.getFirstName() + " " + view.getLastName()),
                        view.getPlayerProfileId());
            }
        }
        Set<UUID> linked = scorecard.players().stream()
                .map(ResultPlayerDto::playerProfileId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> names = new HashMap<>();
        // only this club's players are named: a posted scorecard may carry any profile id
        eligibility.loadPlayers(linked).forEach((id, info) -> {
            if (match.getClubId().equals(info.clubId())) {
                names.put(id, info.fullName());
            }
        });
        Map<ResultSide, ScorecardSelectionState> selection = new HashMap<>();
        Map<UUID, MatchSide> sidesByTeam = matchSideRepository.findByMatchId(match.getId()).stream()
                .collect(Collectors.toMap(MatchSide::getTeamId, side -> side, (a, b) -> a));
        oursSides(match).forEach((side, teamId) -> {
            if (scorecard.players().stream().anyMatch(p -> p.side() == side)) {
                MatchSide matchSide = sidesByTeam.get(teamId);
                selection.put(side, selectionState(
                        matchSide, matchSide != null && matchSidePlayerRepository.countByMatchSideId(matchSide.getId()) > 0));
            }
        });
        return new ScorecardContext(maxBalls, squads, registered, names, selection);
    }

    // ---- building the read model ----

    private ScorecardRows load(UUID matchResultId) {
        List<MatchInnings> innings = inningsRepository.findByMatchResultIdOrderBySequence(matchResultId).stream()
                .filter(i -> i.getKind() == InningsKind.REGULAR)
                .toList();
        List<UUID> ids = innings.stream().map(MatchInnings::getId).toList();
        return new ScorecardRows(
                innings,
                playerRepository.findByMatchResultIdOrderByCreatedAtAscIdAsc(matchResultId),
                ids.isEmpty() ? List.of() : battingRepository.findByMatchInningsIdIn(ids),
                ids.isEmpty() ? List.of() : bowlingRepository.findByMatchInningsIdIn(ids),
                ids.isEmpty() ? List.of() : fieldingRepository.findByMatchInningsIdIn(ids));
    }

    private ScorecardDto build(MatchResult result, Match match) {
        ScorecardRows loaded = load(result.getId());
        List<MatchAward> awards = awardRepository.findByMatchResultId(result.getId());
        boolean frozen = result.getStatus() == ResultStatus.PUBLISHED;
        Set<UUID> suggested = suggestions(loaded);
        Map<UUID, ResultSide> sideByInnings = loaded.innings().stream()
                .collect(Collectors.toMap(MatchInnings::getId, MatchInnings::getBattingSide));
        Map<UUID, PlayerInfo> names = eligibility.loadPlayers(loaded.players().stream()
                .map(ResultPlayer::getPlayerProfileId).filter(Objects::nonNull).collect(Collectors.toSet()));
        Map<UUID, ResultPlayer> playersById = loaded.players().stream()
                .collect(Collectors.toMap(ResultPlayer::getId, p -> p));
        Set<UUID> opposition = oppositionPlayerIds(loaded);
        Map<UUID, Map<UUID, Credit>> creditsByInnings = new HashMap<>();
        loaded.batting().stream().collect(Collectors.groupingBy(BattingEntry::getMatchInningsId))
                .forEach((inningsId, rows) -> creditsByInnings.put(inningsId, DismissalCredits.derive(rows.stream()
                        .map(e -> new Dismissal<>(e.getHowOut(), e.getBowlerResultPlayerId(), e.getFielderResultPlayerId()))
                        .toList())));

        List<ResultPlayerDto> players = loaded.players().stream().map(p -> {
            PlayerInfo info = p.getPlayerProfileId() == null ? null : names.get(p.getPlayerProfileId());
            return mapper.toPlayerDto(p, info == null ? null : info.firstName(), info == null ? null : info.lastName());
        }).toList();
        Map<UUID, Integer> sequenceByInnings = loaded.innings().stream()
                .collect(Collectors.toMap(MatchInnings::getId, MatchInnings::getSequence));
        List<BattingEntryDto> batting = loaded.batting().stream()
                .sorted(Comparator.comparing((BattingEntry e) -> sequenceByInnings.get(e.getMatchInningsId()))
                        .thenComparing(BattingEntry::getPosition, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(e -> opposition.contains(e.getResultPlayerId())
                        ? mapper.toBattingDto(e, sideByInnings.get(e.getMatchInningsId()), null, null)
                        : mapper.toBattingDto(e, sideByInnings.get(e.getMatchInningsId()),
                                suggested.contains(e.getId()), shown(frozen, e.getFeatured(), e.getFeaturedOverride(), suggested.contains(e.getId()), canBeFeatured(e))))
                .toList();
        List<BowlingEntryDto> bowling = loaded.bowling().stream()
                .sorted(Comparator.comparing((BowlingEntry e) -> sequenceByInnings.get(e.getMatchInningsId()))
                        .thenComparing(BowlingEntry::getBowlingOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(e -> {
                    int derivedWickets = creditsByInnings.getOrDefault(e.getMatchInningsId(), Map.of())
                            .getOrDefault(e.getResultPlayerId(), Credit.NONE).wickets();
                    return opposition.contains(e.getResultPlayerId())
                            ? mapper.toBowlingDto(e, sideByInnings.get(e.getMatchInningsId()), null, null, derivedWickets)
                            : mapper.toBowlingDto(e, sideByInnings.get(e.getMatchInningsId()),
                                    suggested.contains(e.getId()), shown(frozen, e.getFeatured(), e.getFeaturedOverride(), suggested.contains(e.getId()), canBeFeatured(e)),
                                    derivedWickets);
                })
                .toList();
        List<FieldingEntryDto> fielding = loaded.fielding().stream()
                .sorted(Comparator.comparing((FieldingEntry e) -> sequenceByInnings.get(e.getMatchInningsId())))
                .map(e -> {
                    Credit derived = creditsByInnings.getOrDefault(e.getMatchInningsId(), Map.of())
                            .getOrDefault(e.getResultPlayerId(), Credit.NONE);
                    return opposition.contains(e.getResultPlayerId())
                            ? mapper.toFieldingDto(e, sideByInnings.get(e.getMatchInningsId()), null, null, derived)
                            : mapper.toFieldingDto(e, sideByInnings.get(e.getMatchInningsId()),
                                    suggested.contains(e.getId()), shown(frozen, e.getFeatured(), e.getFeaturedOverride(), suggested.contains(e.getId()), true),
                                    derived);
                })
                .toList();
        List<MatchAwardDto> awardDtos = awards.stream().map(a -> {
            ResultPlayer player = a.getResultPlayerId() == null ? null : playersById.get(a.getResultPlayerId());
            return mapper.toAwardDto(a, player != null ? nameOf(player, names) : a.getDisplayName());
        }).toList();
        return new ScorecardDto(
                players, batting, bowling, fielding, awardDtos,
                loaded.innings().stream()
                        .map(i -> mapper.toInningsDto(i, creditsByInnings.containsKey(i.getId())))
                        .toList(),
                statuses(loaded));
    }

    private static boolean shown(boolean frozen, Boolean stored, FeaturedOverride override, boolean suggested,
            boolean canBeFeatured) {
        return frozen && stored != null ? stored && canBeFeatured : effective(override, suggested, canBeFeatured);
    }

    /** A batter who did not bat or scored no run, and a bowler with neither a ball nor a wicket, can never be featured. */
    private static boolean canBeFeatured(BattingEntry e) {
        return e.getHowOut() != null && e.getHowOut().batted() && e.getRuns() != null && e.getRuns() > 0;
    }

    private static boolean canBeFeatured(BowlingEntry e) {
        return e.getBalls() > 0 || e.getWickets() > 0;
    }

    /** A stored FEATURE override on an entry that cannot be featured is ignored; HIDE is unaffected. */
    private static boolean effective(FeaturedOverride override, boolean suggested, boolean canBeFeatured) {
        if (override == FeaturedOverride.FEATURE) {
            return canBeFeatured;
        }
        if (override == FeaturedOverride.HIDE) {
            return false;
        }
        return suggested;
    }

    /** The ids of the entries the standout rules suggest, per innings (entry ids are unique across tables). */
    private Set<UUID> suggestions(ScorecardRows loaded) {
        Set<UUID> suggested = new HashSet<>();
        Set<UUID> opposition = oppositionPlayerIds(loaded);
        for (MatchInnings innings : loaded.innings()) {
            List<StandoutRules.Batter<UUID>> batters = loaded.batting().stream()
                    .filter(e -> e.getMatchInningsId().equals(innings.getId())
                            && !opposition.contains(e.getResultPlayerId())
                            && e.getHowOut() != null && e.getHowOut().batted() && e.getRuns() != null)
                    .map(e -> new StandoutRules.Batter<>(e.getId(), e.getRuns(), e.getBalls()))
                    .toList();
            suggested.addAll(StandoutRules.battingSuggestions(batters, innings.getRuns()));
            List<StandoutRules.Bowler<UUID>> bowlers = loaded.bowling().stream()
                    .filter(e -> e.getMatchInningsId().equals(innings.getId())
                            && !opposition.contains(e.getResultPlayerId()))
                    .map(e -> new StandoutRules.Bowler<>(e.getId(), e.getBalls(), e.getRuns(), e.getWickets()))
                    .toList();
            suggested.addAll(StandoutRules.bowlingSuggestions(bowlers, innings.getRuns(), innings.getBalls()));
            List<StandoutRules.Fielder<UUID>> fielders = loaded.fielding().stream()
                    .filter(e -> e.getMatchInningsId().equals(innings.getId())
                            && !opposition.contains(e.getResultPlayerId()))
                    .map(e -> new StandoutRules.Fielder<>(e.getId(), e.getCatches() + e.getStumpings() + e.getRunOuts()))
                    .toList();
            suggested.addAll(StandoutRules.fieldingSuggestions(fielders));
        }
        return suggested;
    }

    /**
     * Per side (the opposition's too): NONE with no players; COMPLETE when the side has at least one innings and each
     * innings it batted or bowled in has its rows; else PARTIAL (a team list alone is partial).
     */
    private List<ScorecardSideStatusDto> statuses(ScorecardRows loaded) {
        List<ScorecardSideStatusDto> statuses = new ArrayList<>();
        for (ResultSide side : ResultSide.values()) {
            boolean hasPlayers = loaded.players().stream().anyMatch(p -> p.getSide() == side);
            if (!hasPlayers) {
                statuses.add(new ScorecardSideStatusDto(side, ScorecardStatus.NONE));
                continue;
            }
            Set<UUID> ownBatting = loaded.innings().stream()
                    .filter(i -> i.getBattingSide() == side).map(MatchInnings::getId).collect(Collectors.toSet());
            Set<UUID> ownBowling = loaded.innings().stream()
                    .filter(i -> i.getBattingSide() != side).map(MatchInnings::getId).collect(Collectors.toSet());
            boolean batted = ownBatting.isEmpty()
                    || loaded.batting().stream().anyMatch(e -> ownBatting.contains(e.getMatchInningsId()));
            boolean bowled = ownBowling.isEmpty()
                    || loaded.bowling().stream().anyMatch(e -> ownBowling.contains(e.getMatchInningsId()));
            boolean anyInnings = !ownBatting.isEmpty() || !ownBowling.isEmpty();
            statuses.add(new ScorecardSideStatusDto(
                    side, anyInnings && batted && bowled ? ScorecardStatus.COMPLETE : ScorecardStatus.PARTIAL));
        }
        return statuses;
    }

    // ---- helpers ----

    /** The sides of the match that are one of this club's teams, with their team ids. */
    private Map<ResultSide, UUID> oursSides(Match match) {
        Map<ResultSide, UUID> ours = new HashMap<>();
        if (match.getHomeTeamId() != null) {
            ours.put(ResultSide.HOME, match.getHomeTeamId());
        }
        if (match.getAwayTeamId() != null) {
            ours.put(ResultSide.AWAY, match.getAwayTeamId());
        }
        return ours;
    }

    /**
     * A player of one of our sides is not marked as the opposition; a player of the other side must be, and only in a
     * match with exactly one ours side (a derby has none).
     */
    private void checkSides(ScorecardDto scorecard, Map<ResultSide, UUID> ours) {
        for (ResultPlayerDto player : scorecard.players()) {
            boolean oursSide = ours.containsKey(player.side());
            if (player.opposition() && (oursSide || ours.size() != 1)) {
                throw reject(ErrorCode.OPPOSITION_NOT_ALLOWED, ResultWizardStep.TEAMS, player.side(),
                        "Only the other side of a match against an outside team can hold opposition players.");
            }
            if (!player.opposition() && !oursSide) {
                throw reject(ErrorCode.SCORECARD_PLAYER_NOT_OURS, ResultWizardStep.TEAMS, player.side(),
                        "A player of a side that is not one of this club's teams must be marked as the opposition.");
            }
        }
    }

    private static Set<UUID> oppositionPlayerIds(ScorecardRows loaded) {
        return loaded.players().stream().filter(ResultPlayer::isOpposition).map(ResultPlayer::getId)
                .collect(Collectors.toSet());
    }

    /** NONE with no selection rows (or no selection), NOT_ANNOUNCED for an unannounced one, else ANNOUNCED. */
    private static ScorecardSelectionState selectionState(MatchSide matchSide, boolean hasPlayers) {
        if (matchSide == null || !hasPlayers) {
            return ScorecardSelectionState.NONE;
        }
        return matchSide.isAnnounced() ? ScorecardSelectionState.ANNOUNCED : ScorecardSelectionState.NOT_ANNOUNCED;
    }

    private void checkProfilesBelongToClub(ScorecardDto scorecard, UUID clubId) {
        Set<UUID> profileIds = new HashSet<>();
        scorecard.players().forEach(p -> {
            if (p.playerProfileId() != null) {
                profileIds.add(p.playerProfileId());
            }
            if (p.replacedPlayerProfileId() != null) {
                profileIds.add(p.replacedPlayerProfileId());
            }
        });
        if (profileIds.isEmpty()) {
            return;
        }
        Map<UUID, PlayerProfile> profiles = playerProfileRepository.findAllById(profileIds).stream()
                .collect(Collectors.toMap(PlayerProfile::getId, Function.identity()));
        for (UUID id : profileIds) {
            PlayerProfile profile = profiles.get(id);
            if (profile == null || !profile.getClubId().equals(clubId)) {
                throw reject(ErrorCode.SCORECARD_PLAYER_OTHER_CLUB, ResultWizardStep.TEAMS, null,
                        "A player on the scorecard does not belong to this club.");
            }
        }
    }

    /** A dismissal's bowler or fielder: an id or a client key of a player in the body, or null for none. */
    private static UUID resolveOptional(Map<String, UUID> playerIdByRef, String ref) {
        if (ref == null || ref.isBlank()) {
            return null;
        }
        UUID resolved = playerIdByRef.get(ref);
        if (resolved == null) {
            throw reject(ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.BATTING, null,
                    "A dismissal names a player who is not on the scorecard.");
        }
        return resolved;
    }

    private static UUID resolve(Map<String, UUID> playerIdByRef, UUID id, String clientKey) {
        UUID resolved = id != null ? playerIdByRef.get(id.toString()) : (clientKey == null ? null : playerIdByRef.get(clientKey));
        if (resolved == null) {
            throw reject(ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.TEAMS, null,
                    "A scorecard row refers to a player who is not on the scorecard.");
        }
        return resolved;
    }

    private static String nameOf(ResultPlayer player, Map<UUID, PlayerInfo> names) {
        PlayerInfo info = player.getPlayerProfileId() == null ? null : names.get(player.getPlayerProfileId());
        return info != null ? info.fullName() : player.getDisplayName();
    }

    private static InvalidResultException reject(
            ErrorCode code, ResultWizardStep step, ResultSide side, String message) {
        ResultIssueDto issue = new ResultIssueDto(code.name(), step, side, ResultIssueSeverity.ERROR, message);
        return new InvalidResultException("The scorecard cannot be saved as entered.", List.of(message), List.of(), List.of(issue));
    }
}
