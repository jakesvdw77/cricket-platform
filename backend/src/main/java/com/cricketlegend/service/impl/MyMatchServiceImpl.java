package com.cricketlegend.service.impl;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchPhase;
import com.cricketlegend.domain.MatchSelectionState;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.MyMatchStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.LiveScoreSource;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.MyFieldDto;
import com.cricketlegend.dto.MyMatchAvailabilityDto;
import com.cricketlegend.dto.MyMatchDto;
import com.cricketlegend.dto.MyMatchListDto;
import com.cricketlegend.dto.MyMatchPlayerDto;
import com.cricketlegend.dto.MyMatchRefDto;
import com.cricketlegend.dto.MyMatchResultDto;
import com.cricketlegend.dto.MyMatchSideDto;
import com.cricketlegend.dto.MyMatchStreamDto;
import com.cricketlegend.dto.MyMatchSummaryDto;
import com.cricketlegend.dto.MyMatchTeamDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MyFieldService;
import com.cricketlegend.service.MyMatchService;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.LeagueResultText;
import com.cricketlegend.service.support.LeagueSide;
import com.cricketlegend.service.support.LiveScoreResolver;
import com.cricketlegend.service.support.MyMatchContext;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.PlayerDisplayName;
import com.cricketlegend.service.support.SeasonResolution;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.service.support.StreamEmbed;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/135 (Player Hub match view). Authorised only by {@link MyPlayerAccess#resolve}; a match is the held
 * player's when the player's squad row for the match's season names the home or away team. Anything else, including
 * another club's match, is a 404. The phase (live, upcoming, recent) comes only from {@link MatchPhase}, links only
 * through {@link LiveScoreResolver} and {@link StreamEmbed}, results only from {@link ResultService#publishedResults}.
 * An unannounced side's players are never returned; juniors appear as initials. No manager-only data is mapped.
 */
@Service
class MyMatchServiceImpl implements MyMatchService {

    static final int UPCOMING_CAP = 20;
    static final int RECENT_CAP = 10;
    static final int RECENT_MAX = 100;
    private static final int FUTURE_READ = 200;
    private static final int PAST_READ = 50;
    private static final int JUNIOR_LEAGUE_MAX_AGE = 18;

    private final MyPlayerAccess access;
    private final SeasonRepository seasonRepository;
    private final TeamSquadMemberRepository squadRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;
    private final MatchSideRepository sideRepository;
    private final MatchSidePlayerRepository sidePlayerRepository;
    private final MatchAvailabilityPollRepository pollRepository;
    private final PlayerAvailabilityRepository availabilityRepository;
    private final PlayerProfileRepository profileRepository;
    private final PersonRepository personRepository;
    private final ResultService resultService;
    private final MyFieldService fieldService;

    MyMatchServiceImpl(
            MyPlayerAccess access,
            SeasonRepository seasonRepository,
            TeamSquadMemberRepository squadRepository,
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository,
            MatchSideRepository sideRepository,
            MatchSidePlayerRepository sidePlayerRepository,
            MatchAvailabilityPollRepository pollRepository,
            PlayerAvailabilityRepository availabilityRepository,
            PlayerProfileRepository profileRepository,
            PersonRepository personRepository,
            ResultService resultService,
            MyFieldService fieldService) {
        this.access = access;
        this.seasonRepository = seasonRepository;
        this.squadRepository = squadRepository;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
        this.sideRepository = sideRepository;
        this.sidePlayerRepository = sidePlayerRepository;
        this.pollRepository = pollRepository;
        this.availabilityRepository = availabilityRepository;
        this.profileRepository = profileRepository;
        this.personRepository = personRepository;
        this.resultService = resultService;
        this.fieldService = fieldService;
    }

    @Override
    @Transactional(readOnly = true)
    public MyMatchListDto list(Authentication authentication, String playerKey, Integer recentLimit) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        int limit = recentLimit == null ? RECENT_CAP : recentLimit;
        if (limit < 1 || limit > RECENT_MAX) {
            throw new ValidationException("recentLimit must be between 1 and " + RECENT_MAX + ".");
        }
        UUID clubId = held.profile().getClubId();
        UUID profileId = held.profile().getId();
        Map<UUID, Set<UUID>> squad = squadTeamsBySeason(profileId);
        Set<UUID> teamIds = squad.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
        if (teamIds.isEmpty()) {
            return new MyMatchListDto(List.of(), List.of(), List.of(), 0, 0);
        }
        Instant now = ServerClock.now();
        Instant liveFrom = now.minusSeconds(MatchPhase.LIVE_WINDOW_HOURS * 3600L);
        List<Match> matches = new ArrayList<>(matchRepository.findActiveForTeamsFrom(
                clubId, teamIds, liveFrom, PageRequest.of(0, FUTURE_READ)));
        matches.addAll(matchRepository.findActiveForTeamsBefore(clubId, teamIds, liveFrom, PageRequest.of(0, Math.max(PAST_READ, limit * 2))));
        matches = matches.stream().filter(m -> isMine(m, squad)).toList();
        if (matches.isEmpty()) {
            return new MyMatchListDto(List.of(), List.of(), List.of(), 0, 0);
        }
        MyMatchContext ctx = load(clubId, matches);
        UUID currentSeason = SeasonResolution.currentSeasonId(seasonRepository.findByClubId(clubId));

        List<MyMatchSummaryDto> live = new ArrayList<>();
        List<MyMatchSummaryDto> upcoming = new ArrayList<>();
        List<MyMatchSummaryDto> recent = new ArrayList<>();
        for (Match m : matches) {
            MyMatchSummaryDto row = summary(m, now, squad.get(m.getSeasonId()), profileId, ctx);
            if (row.phase() == MatchPhase.LIVE) {
                live.add(row);
            } else if (row.phase() == MatchPhase.UPCOMING) {
                if (m.getSeasonId().equals(currentSeason)) {
                    upcoming.add(row);
                }
            } else {
                recent.add(row);
            }
        }
        Comparator<MyMatchSummaryDto> soonest =
                Comparator.comparing(MyMatchSummaryDto::date).thenComparing(r -> r.time() == null ? java.time.LocalTime.MIN : r.time());
        live.sort(soonest.reversed());
        upcoming.sort(soonest);
        recent.sort(soonest.reversed());
        // The totals are counted over the rows read (at most FUTURE_READ ahead, max(PAST_READ, 2 x limit) behind).
        return new MyMatchListDto(live, cap(upcoming, UPCOMING_CAP), cap(recent, limit), upcoming.size(), recent.size());
    }

    @Override
    @Transactional(readOnly = true)
    public MyMatchDto get(Authentication authentication, String playerKey, UUID matchId) {
        HeldPlayer held = access.resolve(authentication, playerKey);
        UUID clubId = held.profile().getClubId();
        UUID profileId = held.profile().getId();
        Match m = matchRepository.findById(matchId).filter(x -> clubId.equals(x.getClubId())).orElse(null);
        Map<UUID, Set<UUID>> squad = squadTeamsBySeason(profileId);
        if (m == null || !isMine(m, squad)) {
            throw new NotFoundException("Match not found");
        }
        Set<UUID> myTeams = squad.get(m.getSeasonId());
        Instant now = ServerClock.now();
        MyMatchContext ctx = load(clubId, List.of(m));
        MatchResultDto result = ctx.published().get(m.getId());
        Instant start = startOf(m);
        MatchPhase phase = MatchPhase.of(m.isActive(), result != null, start, now);
        League league = m.getLeagueId() == null ? null : ctx.leagues().get(m.getLeagueId());
        Season season = seasonRepository.findById(m.getSeasonId()).orElse(null);

        LeagueSide home = side(m, true, ctx);
        LeagueSide away = side(m, false, ctx);
        boolean initialsAll = (held.subject() != null
                        && PlayerDisplayName.isJunior(held.subject().getDateOfBirth(), LocalDate.now()))
                || (league != null && league.getMaxAge() != null && league.getMaxAge() <= JUNIOR_LEAGUE_MAX_AGE);
        Map<UUID, Person> people = peopleByProfile(m, ctx);
        MyMatchSideDto homeSide = sideDto(m, m.getHomeTeamId(), home, myTeams, ctx, people, initialsAll);
        MyMatchSideDto awaySide = sideDto(m, m.getAwayTeamId(), away, myTeams, ctx, people, initialsAll);

        MyFieldDto field = m.getPlayingAreaId() == null ? null
                : fieldService.describe(clubId, Set.of(m.getPlayingAreaId())).stream().findFirst().orElse(null);
        MyMatchStreamDto stream = phase == MatchPhase.LIVE ? StreamEmbed.of(m.getStreamingUrl()) : null;
        LiveScoreSource liveScore = LiveScoreResolver.resolve(m.getScoringUrl(), phase);
        MyMatchStatus status = result != null ? MyMatchStatus.PLAYED : !m.isActive() ? MyMatchStatus.CANCELLED : MyMatchStatus.UPCOMING;

        return new MyMatchDto(
                m.getId(), ServerClock.localDate(m.getMatchDate()), ServerClock.localTime(m.getMatchDate()),
                phase == MatchPhase.LIVE ? start : null, phase, status,
                league == null ? null : new MyMatchRefDto(league.getId(), league.getName()),
                season == null ? null : new MyMatchRefDto(season.getId(), season.getLabel()),
                MyLeagueServiceImpl.blankToNull(m.getVenue()),
                field == null ? null : field.id(), field == null ? null : field.name(),
                field == null ? null : field.latitude(), field == null ? null : field.longitude(),
                field == null ? null : field.accessLatitude(), field == null ? null : field.accessLongitude(),
                field == null ? null : field.accessNote(),
                homeSide, awaySide, selection(m, myTeams, profileId, ctx),
                availability(m, myTeams, profileId), liveScore, stream,
                result == null ? null : resultDto(result, home.name(), away.name()));
    }

    // ---- list rows ----

    private MyMatchSummaryDto summary(Match m, Instant now, Set<UUID> myTeams, UUID profileId, MyMatchContext ctx) {
        MatchResultDto result = ctx.published().get(m.getId());
        Instant start = startOf(m);
        MatchPhase phase = MatchPhase.of(m.isActive(), result != null, start, now);
        LeagueSide home = side(m, true, ctx);
        LeagueSide away = side(m, false, ctx);
        League league = m.getLeagueId() == null ? null : ctx.leagues().get(m.getLeagueId());
        boolean hasStream = phase == MatchPhase.LIVE && StreamEmbed.of(m.getStreamingUrl()) != null;
        return new MyMatchSummaryDto(
                m.getId(), phase, ServerClock.localDate(m.getMatchDate()), ServerClock.localTime(m.getMatchDate()),
                phase == MatchPhase.LIVE ? start : null,
                new MyMatchTeamDto(home.name(), home.logoUrl()), new MyMatchTeamDto(away.name(), away.logoUrl()),
                league == null ? null : league.getName(), MyLeagueServiceImpl.blankToNull(m.getVenue()), true,
                selection(m, myTeams, profileId, ctx),
                LiveScoreResolver.resolve(m.getScoringUrl(), phase) != null, hasStream,
                phase == MatchPhase.RECENT && result != null ? resultDto(result, home.name(), away.name()) : null);
    }

    // ---- shared reads ----

    private Map<UUID, Set<UUID>> squadTeamsBySeason(UUID profileId) {
        Map<UUID, Set<UUID>> bySeason = new HashMap<>();
        for (TeamSquadMember row : squadRepository.findByPlayerProfileId(profileId)) {
            bySeason.computeIfAbsent(row.getSeasonId(), k -> new LinkedHashSet<>()).add(row.getTeamId());
        }
        return bySeason;
    }

    private static boolean isMine(Match m, Map<UUID, Set<UUID>> squad) {
        Set<UUID> teams = squad.get(m.getSeasonId());
        return teams != null
                && ((m.getHomeTeamId() != null && teams.contains(m.getHomeTeamId()))
                        || (m.getAwayTeamId() != null && teams.contains(m.getAwayTeamId())));
    }

    private MyMatchContext load(UUID clubId, List<Match> matches) {
        List<UUID> matchIds = matches.stream().map(Match::getId).toList();
        Set<UUID> teamIds = new HashSet<>();
        Set<UUID> leagueIds = new HashSet<>();
        for (Match m : matches) {
            if (m.getHomeTeamId() != null) {
                teamIds.add(m.getHomeTeamId());
            }
            if (m.getAwayTeamId() != null) {
                teamIds.add(m.getAwayTeamId());
            }
            if (m.getLeagueId() != null) {
                leagueIds.add(m.getLeagueId());
            }
        }
        Map<UUID, Team> teams = teamRepository.findAllById(teamIds).stream()
                .filter(t -> clubId.equals(t.getClubId()))
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        Map<UUID, League> leagues = leagueRepository.findAllById(leagueIds).stream()
                .filter(l -> clubId.equals(l.getClubId()))
                .collect(Collectors.toMap(League::getId, Function.identity()));
        Map<UUID, MatchResultDto> published = resultService.publishedResults(clubId, matchIds);
        Map<UUID, List<MatchSide>> sidesByMatch = sideRepository.findByMatchIdIn(matchIds).stream()
                .collect(Collectors.groupingBy(MatchSide::getMatchId));
        List<UUID> sideIds = sidesByMatch.values().stream().flatMap(List::stream).map(MatchSide::getId).toList();
        Map<UUID, List<MatchSidePlayer>> playersBySide = sideIds.isEmpty() ? Map.of()
                : sidePlayerRepository.findByMatchSideIdIn(sideIds).stream()
                        .collect(Collectors.groupingBy(MatchSidePlayer::getMatchSideId));
        return new MyMatchContext(teams, leagues, published, sidesByMatch, playersBySide);
    }

    private static Instant startOf(Match m) {
        return MatchPhase.startOf(ServerClock.localDate(m.getMatchDate()), ServerClock.localTime(m.getMatchDate()));
    }

    private static LeagueSide side(Match m, boolean home, MyMatchContext ctx) {
        return home
                ? MyLeagueServiceImpl.side(m.getHomeTeamId(), m.getHomeTeamName(), m.getHomeTeamLogoUrl(), ctx.teams(), "Home team")
                : MyLeagueServiceImpl.side(m.getAwayTeamId(), m.getAwayTeamName(), m.getAwayTeamLogoUrl(), ctx.teams(), "Away team");
    }

    private static MyMatchResultDto resultDto(MatchResultDto result, String homeName, String awayName) {
        return new MyMatchResultDto(
                LeagueResultText.sideScore(result, ResultSide.HOME), LeagueResultText.sideScore(result, ResultSide.AWAY),
                LeagueResultText.resultLine(result, homeName, awayName));
    }

    /** SELECTED (the twelfth man included), NOT_SELECTED once the player's side is announced, else NOT_ANNOUNCED. */
    private MatchSelectionState selection(Match m, Set<UUID> myTeams, UUID profileId, MyMatchContext ctx) {
        boolean announced = false;
        for (MatchSide side : ctx.sidesByMatch().getOrDefault(m.getId(), List.of())) {
            if (!myTeams.contains(side.getTeamId()) || !side.isAnnounced()) {
                continue;
            }
            announced = true;
            boolean inXi = ctx.playersBySide().getOrDefault(side.getId(), List.of()).stream()
                    .anyMatch(p -> profileId.equals(p.getPlayerProfileId()));
            if (inXi || profileId.equals(side.getTwelfthManPlayerId())) {
                return MatchSelectionState.SELECTED;
            }
        }
        return announced ? MatchSelectionState.NOT_SELECTED : MatchSelectionState.NOT_ANNOUNCED;
    }

    // ---- detail only ----

    private MyMatchSideDto sideDto(
            Match m, UUID teamId, LeagueSide named, Set<UUID> myTeams, MyMatchContext ctx,
            Map<UUID, Person> people, boolean initialsAll) {
        MatchSide side = teamId == null ? null : ctx.sidesByMatch().getOrDefault(m.getId(), List.of()).stream()
                .filter(s -> teamId.equals(s.getTeamId())).findFirst().orElse(null);
        boolean announced = side != null && side.isAnnounced();
        boolean mine = teamId != null && myTeams.contains(teamId);
        List<MyMatchPlayerDto> players = new ArrayList<>();
        if (announced) {
            Set<UUID> listed = new HashSet<>();
            List<MatchSidePlayer> rows = new ArrayList<>(ctx.playersBySide().getOrDefault(side.getId(), List.of()));
            rows.sort(Comparator.comparing(MatchSidePlayer::getBattingOrder, Comparator.nullsLast(Comparator.naturalOrder())));
            LocalDate today = LocalDate.now();
            for (MatchSidePlayer row : rows) {
                listed.add(row.getPlayerProfileId());
                players.add(new MyMatchPlayerDto(
                        displayName(row.getPlayerProfileId(), people, initialsAll, today), row.getRole(),
                        row.getPlayerProfileId().equals(side.getCaptainPlayerId()),
                        row.getPlayerProfileId().equals(side.getWicketKeeperPlayerId()), false));
            }
            UUID twelfth = side.getTwelfthManPlayerId();
            if (twelfth != null && listed.add(twelfth)) {
                players.add(new MyMatchPlayerDto(displayName(twelfth, people, initialsAll, today), null,
                        twelfth.equals(side.getCaptainPlayerId()), twelfth.equals(side.getWicketKeeperPlayerId()), true));
            }
        }
        return new MyMatchSideDto(named.name(), named.logoUrl(), mine, announced, players);
    }

    private static String displayName(UUID profileId, Map<UUID, Person> people, boolean initialsAll, LocalDate today) {
        Person person = people.get(profileId);
        if (person == null) {
            return "";
        }
        boolean initials = initialsAll || PlayerDisplayName.isJunior(person.getDateOfBirth(), today);
        return PlayerDisplayName.of(person.getFirstName(), person.getLastName(), initials);
    }

    /** The people of every player on an announced side of the match, by profile id (one pair of statements). */
    private Map<UUID, Person> peopleByProfile(Match m, MyMatchContext ctx) {
        Set<UUID> profileIds = new HashSet<>();
        for (MatchSide side : ctx.sidesByMatch().getOrDefault(m.getId(), List.of())) {
            if (side.isAnnounced()) {
                ctx.playersBySide().getOrDefault(side.getId(), List.of()).forEach(p -> profileIds.add(p.getPlayerProfileId()));
                if (side.getTwelfthManPlayerId() != null) {
                    profileIds.add(side.getTwelfthManPlayerId());
                }
            }
        }
        if (profileIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, UUID> personByProfile = profileRepository.findAllById(profileIds).stream()
                .collect(Collectors.toMap(PlayerProfile::getId, PlayerProfile::getPersonId));
        Map<UUID, Person> persons = personRepository.findAllById(personByProfile.values()).stream()
                .collect(Collectors.toMap(Person::getId, Function.identity()));
        Map<UUID, Person> out = new HashMap<>();
        personByProfile.forEach((profileId, personId) -> {
            if (persons.containsKey(personId)) {
                out.put(profileId, persons.get(personId));
            }
        });
        return out;
    }

    private MyMatchAvailabilityDto availability(Match m, Set<UUID> myTeams, UUID profileId) {
        for (UUID teamId : new UUID[] {m.getHomeTeamId(), m.getAwayTeamId()}) {
            if (teamId == null || !myTeams.contains(teamId)) {
                continue;
            }
            Optional<MatchAvailabilityPoll> poll = pollRepository.findByMatchIdAndTeamId(m.getId(), teamId);
            if (poll.isPresent()) {
                return new MyMatchAvailabilityDto(
                        availabilityRepository.findByPollIdAndPlayerProfileId(poll.get().getId(), profileId)
                                .map(PlayerAvailability::getStatus).orElse(null),
                        poll.get().getId(), poll.get().isOpen());
            }
        }
        return null;
    }

    private static <T> List<T> cap(List<T> rows, int max) {
        return rows.size() > max ? List.copyOf(rows.subList(0, max)) : rows;
    }
}
