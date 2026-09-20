package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.AddMatchSidePlayerRequest;
import com.cricketlegend.dto.CreateMatchSideRequest;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.ReorderMatchSidePlayersRequest;
import com.cricketlegend.dto.UpdateMatchSidePlayerRequest;
import com.cricketlegend.dto.UpdateMatchSideRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerAgeIneligibleException;
import com.cricketlegend.exception.PlayerNotInSquadException;
import com.cricketlegend.exception.PlayingXiCapExceededException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchSideMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MatchSideService;
import java.time.LocalDate;
import java.time.Period;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/029-league-management.md's MatchSide/MatchSidePlayer business
 * rules, enforced in this order for {@link #addPlayer}: squad membership ({@link
 * #requireSquadMembership}, scoped to the match's own {@code season_id} — a player in that team's
 * squad for a DIFFERENT season is still rejected), not-already-added ({@link ConflictException}),
 * the applicable playing-XI cap ({@code league.maxPlayingXiSize} or 11 — the twelfth man never
 * counts against it), then age eligibility ({@link #requireAgeEligible}, checked against every
 * player reference on the side, not just the ordered XI — cutoff date is {@code
 * league.ageCutoffDate} if set, else {@code season.startDate}, always resolvable now that {@code
 * Match.season_id} is required). {@link #updateSide} additionally requires captain/keeper to
 * already be in the ordered XI, and the twelfth man to NOT be — re-validating squad
 * membership/age eligibility for the twelfth man specifically, since they're a real player
 * reference on the side even though they don't count against the cap. {@link #reorderPlayers}
 * requires the full new order's player-id set to exactly match the side's current players.
 * {@link #removePlayer} also clears {@code captainPlayerId}/{@code wicketKeeperPlayerId} if they
 * pointed at the removed player.
 */
@Service
public class MatchSideServiceImpl implements MatchSideService {

    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;
    private final MatchSideMapper matchSideMapper;
    private final AccessService accessService;

    public MatchSideServiceImpl(
            MatchRepository matchRepository,
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository,
            MatchSideMapper matchSideMapper,
            AccessService accessService) {
        this.matchRepository = matchRepository;
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
        this.matchSideMapper = matchSideMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MatchSideDto> list(Authentication authentication, UUID clubId, UUID matchId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        return matchSideRepository.findByMatchId(matchId).stream().map(this::toDto).toList();
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

        return toDto(side);
    }

    @Override
    @Transactional
    public MatchSideDto updateSide(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, UpdateMatchSideRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        if (request.captainPlayerId() != null
                && !matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(
                        sideId, request.captainPlayerId())) {
            throw new ValidationException(
                    "captainPlayerId " + request.captainPlayerId() + " is not in this side's ordered XI");
        }
        if (request.wicketKeeperPlayerId() != null
                && !matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(
                        sideId, request.wicketKeeperPlayerId())) {
            throw new ValidationException(
                    "wicketKeeperPlayerId " + request.wicketKeeperPlayerId()
                            + " is not in this side's ordered XI");
        }
        if (request.twelfthManPlayerId() != null) {
            if (matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(
                    sideId, request.twelfthManPlayerId())) {
                throw new ValidationException(
                        "twelfthManPlayerId " + request.twelfthManPlayerId()
                                + " must not already be in this side's ordered XI");
            }
            requireSquadMembership(side.getTeamId(), match.getSeasonId(), request.twelfthManPlayerId());
            requireAgeEligible(match, request.twelfthManPlayerId());
        }

        side.setCaptainPlayerId(request.captainPlayerId());
        side.setWicketKeeperPlayerId(request.wicketKeeperPlayerId());
        side.setTwelfthManPlayerId(request.twelfthManPlayerId());
        if (side.isAnnounced()) {
            side.setAnnounced(false);
        }
        side = matchSideRepository.save(side);

        return toDto(side);
    }

    @Override
    @Transactional
    public MatchSideDto addPlayer(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, AddMatchSidePlayerRequest request) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);
        UUID playerId = request.playerProfileId();

        requireSquadMembership(side.getTeamId(), match.getSeasonId(), playerId);

        if (matchSidePlayerRepository.existsByMatchSideIdAndPlayerProfileId(sideId, playerId)) {
            throw new ConflictException("Player " + playerId + " is already added to side " + sideId);
        }

        int cap = applicableCap(match);
        long currentCount = matchSidePlayerRepository.countByMatchSideId(sideId);
        if (currentCount >= cap) {
            throw new PlayingXiCapExceededException(
                    "Side " + sideId + " already has the maximum " + cap + " playing XI player(s)");
        }

        requireAgeEligible(match, playerId);

        int nextBattingOrder = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId)
                .stream()
                .mapToInt(MatchSidePlayer::getBattingOrder)
                .max()
                .orElse(0)
                + 1;

        MatchSidePlayer player = MatchSidePlayer.builder()
                .matchSideId(sideId)
                .playerProfileId(playerId)
                .battingOrder(nextBattingOrder)
                .role(request.role())
                .build();
        matchSidePlayerRepository.save(player);

        if (side.isAnnounced()) {
            side.setAnnounced(false);
            side = matchSideRepository.save(side);
        }

        return toDto(side);
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

        return toDto(side);
    }

    @Override
    @Transactional
    public MatchSideDto removePlayer(
            Authentication authentication, UUID clubId, UUID matchId, UUID sideId, UUID playerProfileId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        matchSidePlayerRepository
                .findByMatchSideIdAndPlayerProfileId(sideId, playerProfileId)
                .orElseThrow(() -> new NotFoundException(
                        "Player " + playerProfileId + " is not on side " + sideId));
        matchSidePlayerRepository.deleteByMatchSideIdAndPlayerProfileId(sideId, playerProfileId);

        boolean changed = false;
        if (playerProfileId.equals(side.getCaptainPlayerId())) {
            side.setCaptainPlayerId(null);
            changed = true;
        }
        if (playerProfileId.equals(side.getWicketKeeperPlayerId())) {
            side.setWicketKeeperPlayerId(null);
            changed = true;
        }
        if (side.isAnnounced()) {
            side.setAnnounced(false);
            changed = true;
        }
        if (changed) {
            side = matchSideRepository.save(side);
        }

        return toDto(side);
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

        List<MatchSidePlayer> current = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId);
        Set<UUID> currentIds = new HashSet<>();
        for (MatchSidePlayer player : current) {
            currentIds.add(player.getPlayerProfileId());
        }
        Set<UUID> requestedIds = new HashSet<>(request.playerProfileIds());
        if (!currentIds.equals(requestedIds) || currentIds.size() != request.playerProfileIds().size()) {
            throw new ValidationException(
                    "playerProfileIds must exactly match the side's current players");
        }

        Map<UUID, MatchSidePlayer> byPlayerId = new HashMap<>();
        for (MatchSidePlayer player : current) {
            byPlayerId.put(player.getPlayerProfileId(), player);
        }

        // Two-phase reassignment to avoid transiently violating the (match_side_id, batting_order)
        // unique constraint when the new order is a permutation of the old one.
        int i = 1;
        for (UUID playerId : request.playerProfileIds()) {
            MatchSidePlayer player = byPlayerId.get(playerId);
            player.setBattingOrder(-(i));
            matchSidePlayerRepository.save(player);
            i++;
        }
        matchSidePlayerRepository.flush();

        i = 1;
        for (UUID playerId : request.playerProfileIds()) {
            MatchSidePlayer player = byPlayerId.get(playerId);
            player.setBattingOrder(i);
            matchSidePlayerRepository.save(player);
            i++;
        }

        if (side.isAnnounced()) {
            side.setAnnounced(false);
            side = matchSideRepository.save(side);
        }

        return toDto(side);
    }

    @Override
    @Transactional
    public MatchSideDto announce(Authentication authentication, UUID clubId, UUID matchId, UUID sideId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        if (matchSidePlayerRepository.countByMatchSideId(sideId) == 0) {
            throw new ValidationException("Side " + sideId + " has no players to announce");
        }

        side.setAnnounced(true);
        side = matchSideRepository.save(side);

        return toDto(side);
    }

    @Override
    @Transactional
    public MatchSideDto unannounce(Authentication authentication, UUID clubId, UUID matchId, UUID sideId) {
        Match match = findMatchOrThrowForClub(clubId, matchId);
        assertCanAdministerMatch(authentication, clubId, match);
        MatchSide side = findSideOrThrowForMatch(matchId, sideId);

        side.setAnnounced(false);
        side = matchSideRepository.save(side);

        return toDto(side);
    }

    private int applicableCap(Match match) {
        if (match.getLeagueId() == null) {
            return 11;
        }
        League league = leagueRepository
                .findById(match.getLeagueId())
                .orElseThrow(() -> new NotFoundException("League not found: " + match.getLeagueId()));
        return league.getMaxPlayingXiSize();
    }

    private void requireSquadMembership(UUID teamId, UUID seasonId, UUID playerId) {
        if (!teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, playerId)) {
            throw new PlayerNotInSquadException(playerName(playerId) + " is not in this team's squad for this season");
        }
    }

    // Best-effort display name for a user-facing exception message — falls back to the raw id
    // if the player/person row can't be resolved (shouldn't happen on the calling paths here,
    // since playerId is always already known to reference a real player by this point).
    private String playerName(UUID playerId) {
        return playerProfileRepository
                .findById(playerId)
                .flatMap(profile -> personRepository.findById(profile.getPersonId()))
                .map(person -> person.getFirstName() + " " + person.getLastName())
                .orElse("Player " + playerId);
    }

    private void requireAgeEligible(Match match, UUID playerId) {
        if (match.getLeagueId() == null) {
            return;
        }
        League league = leagueRepository
                .findById(match.getLeagueId())
                .orElseThrow(() -> new NotFoundException("League not found: " + match.getLeagueId()));
        if (league.getMinAge() == null && league.getMaxAge() == null) {
            return;
        }

        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        Person person = personRepository
                .findById(profile.getPersonId())
                .orElseThrow(() -> new NotFoundException("Person not found: " + profile.getPersonId()));

        String playerName = person.getFirstName() + " " + person.getLastName();

        LocalDate dateOfBirth = person.getDateOfBirth();
        if (dateOfBirth == null) {
            throw new PlayerAgeIneligibleException(
                    playerName + " has no recorded date of birth; required for this league's age rule");
        }

        LocalDate cutoffDate = league.getAgeCutoffDate();
        if (cutoffDate == null) {
            Season season = seasonRepository
                    .findById(match.getSeasonId())
                    .orElseThrow(() -> new NotFoundException("Season not found: " + match.getSeasonId()));
            cutoffDate = season.getStartDate();
        }

        int age = Period.between(dateOfBirth, cutoffDate).getYears();
        if (league.getMinAge() != null && age < league.getMinAge()) {
            throw new PlayerAgeIneligibleException(
                    playerName + " is " + age + ", below this league's minAge of " + league.getMinAge());
        }
        if (league.getMaxAge() != null && age > league.getMaxAge()) {
            throw new PlayerAgeIneligibleException(
                    playerName + " is " + age + ", above this league's maxAge of " + league.getMaxAge());
        }
    }

    private MatchSideDto toDto(MatchSide side) {
        List<MatchSidePlayer> players =
                matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(side.getId());
        return matchSideMapper.toDto(side, players);
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
