package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.dto.PublicAvailabilityPollDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PollClosedException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.AvailabilityPollSquadResolver;
import com.cricketlegend.service.PublicAvailabilityPollService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/032-match-availability-polls.md: both methods resolve {@code
 * MatchAvailabilityPoll} -&gt; {@code Match} -&gt; ({@code Team}/{@code League}/{@code Season} for
 * display names) entirely from {@code pollId}, no {@code clubId} anywhere — the poll's own UUID is
 * the entire access boundary. {@link #setAvailability} 404s ({@link NotFoundException}) if {@code
 * pollId} doesn't exist or {@code playerProfileId} isn't one of the poll's own resolved squad rows
 * (not a real {@code TeamSquadMember} for this poll's team+season), then 409s ({@link
 * PollClosedException}) if the poll is currently closed, otherwise upserts the {@link
 * PlayerAvailability} row (find-by-poll-and-player, else build new) — {@code updatedBy} always
 * {@code null}, no authenticated identity on this write path. Squad/response resolution reuses the
 * same shared {@link AvailabilityPollSquadResolver} as {@code MatchAvailabilityPollServiceImpl}.
 */
@Service
public class PublicAvailabilityPollServiceImpl implements PublicAvailabilityPollService {

    private final MatchAvailabilityPollRepository matchAvailabilityPollRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final AvailabilityPollSquadResolver squadResolver;

    public PublicAvailabilityPollServiceImpl(
            MatchAvailabilityPollRepository matchAvailabilityPollRepository,
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            AvailabilityPollSquadResolver squadResolver) {
        this.matchAvailabilityPollRepository = matchAvailabilityPollRepository;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.squadResolver = squadResolver;
    }

    @Override
    @Transactional(readOnly = true)
    public PublicAvailabilityPollDto getPoll(UUID pollId) {
        MatchAvailabilityPoll poll = findPollOrThrow(pollId);
        Match match = findMatchOrThrow(poll);
        return toDto(poll, match);
    }

    @Override
    @Transactional
    public PublicAvailabilityPollDto setAvailability(
            UUID pollId, UUID playerProfileId, AvailabilityStatus status) {
        MatchAvailabilityPoll poll = findPollOrThrow(pollId);
        Match match = findMatchOrThrow(poll);

        List<PlayerAvailabilityRowDto> squadRows =
                squadResolver.resolveSquadRows(poll.getTeamId(), match.getSeasonId());
        boolean inSquad = squadRows.stream().anyMatch(row -> row.playerProfileId().equals(playerProfileId));
        if (!inSquad) {
            throw new NotFoundException(
                    "Player " + playerProfileId + " is not part of this poll's own squad");
        }

        if (!poll.isOpen()) {
            throw new PollClosedException("Poll is closed: " + pollId);
        }

        PlayerAvailability availability = playerAvailabilityRepository
                .findByPollIdAndPlayerProfileId(pollId, playerProfileId)
                .orElseGet(() -> PlayerAvailability.builder()
                        .pollId(pollId)
                        .playerProfileId(playerProfileId)
                        .build());
        availability.setStatus(status);
        playerAvailabilityRepository.save(availability);

        return toDto(poll, match);
    }

    private PublicAvailabilityPollDto toDto(MatchAvailabilityPoll poll, Match match) {
        String homeTeamName = resolveTeamName(match.getHomeTeamId(), match.getHomeTeamName());
        String awayTeamName = resolveTeamName(match.getAwayTeamId(), match.getAwayTeamName());
        String teamName = resolveTeamName(poll.getTeamId(), null);
        String leagueName = match.getLeagueId() == null ? null : findLeagueName(match.getLeagueId());
        String seasonLabel = findSeasonLabel(match.getSeasonId());

        List<PlayerAvailabilityRowDto> rows = rowsWithStatuses(poll, match.getSeasonId());

        return new PublicAvailabilityPollDto(
                poll.getId(),
                poll.isOpen(),
                homeTeamName,
                awayTeamName,
                match.getMatchDate(),
                match.getVenue(),
                leagueName,
                seasonLabel,
                teamName,
                rows);
    }

    private List<PlayerAvailabilityRowDto> rowsWithStatuses(MatchAvailabilityPoll poll, UUID seasonId) {
        List<PlayerAvailabilityRowDto> squadRows = squadResolver.resolveSquadRows(poll.getTeamId(), seasonId);
        Map<UUID, AvailabilityStatus> statusByPlayerId =
                playerAvailabilityRepository.findByPollId(poll.getId()).stream()
                        .collect(Collectors.toMap(
                                PlayerAvailability::getPlayerProfileId, PlayerAvailability::getStatus));
        return squadRows.stream()
                .map(row -> new PlayerAvailabilityRowDto(
                        row.playerProfileId(),
                        row.firstName(),
                        row.lastName(),
                        row.squadJerseyNumber(),
                        statusByPlayerId.get(row.playerProfileId())))
                .toList();
    }

    private String resolveTeamName(UUID teamId, String fallbackName) {
        if (teamId == null) {
            return fallbackName;
        }
        return teamRepository.findById(teamId).map(Team::getName).orElse(fallbackName);
    }

    private String findLeagueName(UUID leagueId) {
        return leagueRepository.findById(leagueId).map(League::getName).orElse(null);
    }

    private String findSeasonLabel(UUID seasonId) {
        return seasonRepository.findById(seasonId).map(Season::getLabel).orElse(null);
    }

    private MatchAvailabilityPoll findPollOrThrow(UUID pollId) {
        return matchAvailabilityPollRepository
                .findById(pollId)
                .orElseThrow(() -> new NotFoundException("Poll not found: " + pollId));
    }

    private Match findMatchOrThrow(MatchAvailabilityPoll poll) {
        return matchRepository
                .findById(poll.getMatchId())
                .orElseThrow(() -> new NotFoundException("Match not found: " + poll.getMatchId()));
    }
}
