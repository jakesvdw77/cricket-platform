package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.dto.PublicAnswerDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.PublicPollHeaderDto;
import com.cricketlegend.dto.PublicVerifyRequest;
import com.cricketlegend.dto.PublicVerifyResponseDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PollClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.AvailabilityPollSquadResolver;
import com.cricketlegend.service.PublicAvailabilityPollService;
import com.cricketlegend.service.support.MatchSideNames;
import com.cricketlegend.service.support.PublicAudienceMember;
import com.cricketlegend.service.support.PublicAvailabilityToken;
import com.cricketlegend.service.support.PublicAvailabilityVerifier;
import com.cricketlegend.service.support.PublicPollKind;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public squad poll rules (docs/specs/077): the header carries no player data; {@link #verify}
 * matches only players of this poll's own squad ({@link AvailabilityPollSquadResolver}); answers
 * require the token {@code verify} issued for this poll and player, the player must still belong to
 * the squad (404 otherwise), and a closed poll refuses writes (409). Saves set {@code source =
 * PUBLIC_LINK}.
 *
 * <p>{@link #verify} is deliberately NOT {@code @Transactional}: the attempt counters it writes must
 * commit even though a failed verification ends in an exception, so each lookup and counter write
 * runs in its own short transaction instead.
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
    private final PublicAvailabilityVerifier verifier;
    private final PublicAvailabilityToken tokens;

    public PublicAvailabilityPollServiceImpl(
            MatchAvailabilityPollRepository matchAvailabilityPollRepository,
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            PlayerAvailabilityRepository playerAvailabilityRepository,
            AvailabilityPollSquadResolver squadResolver,
            PublicAvailabilityVerifier verifier,
            PublicAvailabilityToken tokens) {
        this.matchAvailabilityPollRepository = matchAvailabilityPollRepository;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.playerAvailabilityRepository = playerAvailabilityRepository;
        this.squadResolver = squadResolver;
        this.verifier = verifier;
        this.tokens = tokens;
    }

    @Override
    @Transactional(readOnly = true)
    public PublicPollHeaderDto getHeader(UUID pollId) {
        MatchAvailabilityPoll poll = findPollOrThrow(pollId);
        Match match = findMatchOrThrow(poll);
        Map<UUID, Team> teams = new HashMap<>();
        teamRepository.findAllById(teamIds(poll, match)).forEach(team -> teams.put(team.getId(), team));
        Team pollTeam = teams.get(poll.getTeamId());
        return new PublicPollHeaderDto(
                poll.getId(),
                poll.isOpen(),
                match.getClubId(),
                MatchSideNames.home(match, teams),
                MatchSideNames.away(match, teams),
                match.getMatchDate(),
                match.getVenue(),
                match.getLeagueId() == null
                        ? null
                        : leagueRepository.findById(match.getLeagueId()).map(League::getName).orElse(null),
                seasonRepository.findById(match.getSeasonId()).map(Season::getLabel).orElse(null),
                pollTeam == null ? null : pollTeam.getName(),
                poll.getScheduledCloseAt());
    }

    @Override
    public PublicVerifyResponseDto verify(UUID pollId, PublicVerifyRequest request, String clientAddress) {
        MatchAvailabilityPoll poll = findPollOrThrow(pollId);
        Match match = findMatchOrThrow(poll);
        List<PublicAudienceMember> audience = squadResolver.resolveSquadRows(poll.getTeamId(), match.getSeasonId())
                .stream()
                .map(row -> new PublicAudienceMember(
                        row.playerProfileId(), row.firstName(), row.lastName(), row.squadJerseyNumber()))
                .toList();
        return verifier.verify(PublicPollKind.POLL, pollId, audience, request, clientAddress,
                () -> teamRepository.findById(poll.getTeamId()).map(Team::getName).orElse(null));
    }

    @Override
    @Transactional(readOnly = true)
    public PublicAnswersDto getAnswers(UUID pollId, UUID playerId, String token) {
        MatchAvailabilityPoll poll = findPollOrThrow(pollId);
        authorise(poll, playerId, token);
        return playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId)
                .map(answer -> new PublicAnswersDto(List.of(new PublicAnswerDto(null, answer.getStatus()))))
                .orElseGet(() -> new PublicAnswersDto(List.of()));
    }

    @Override
    @Transactional
    public PublicAnswersDto saveAnswers(UUID pollId, UUID playerId, String token, PublicAnswersRequest request) {
        MatchAvailabilityPoll poll = findPollOrThrow(pollId);
        authorise(poll, playerId, token);
        if (request.answers().size() != 1) {
            throw new ValidationException("A squad poll takes exactly one answer");
        }
        if (!poll.isOpen()) {
            throw new PollClosedException("Poll is closed: " + pollId);
        }
        PlayerAvailability availability = playerAvailabilityRepository
                .findByPollIdAndPlayerProfileId(pollId, playerId)
                .orElseGet(() -> PlayerAvailability.builder().pollId(pollId).playerProfileId(playerId).build());
        availability.setStatus(request.answers().get(0).status());
        availability.setSource(AnswerSource.PUBLIC_LINK);
        PlayerAvailability saved = playerAvailabilityRepository.save(availability);
        return new PublicAnswersDto(List.of(new PublicAnswerDto(null, saved.getStatus())));
    }

    /** Token first (401), then the player must still belong to the poll's squad (404). */
    private void authorise(MatchAvailabilityPoll poll, UUID playerId, String token) {
        tokens.validate(token, PublicPollKind.POLL, poll.getId(), playerId);
        Match match = findMatchOrThrow(poll);
        Optional<PlayerAvailabilityRowDto> member = squadResolver
                .resolveSquadRows(poll.getTeamId(), match.getSeasonId()).stream()
                .filter(row -> row.playerProfileId().equals(playerId))
                .findFirst();
        if (member.isEmpty()) {
            throw new NotFoundException("Player " + playerId + " is not part of this poll's own squad");
        }
    }

    private List<UUID> teamIds(MatchAvailabilityPoll poll, Match match) {
        return java.util.stream.Stream.of(poll.getTeamId(), match.getHomeTeamId(), match.getAwayTeamId())
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
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
