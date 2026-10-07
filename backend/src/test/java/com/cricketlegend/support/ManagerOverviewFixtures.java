package com.cricketlegend.support;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/**
 * Seeds the clubs, sections, teams, matches, sides, squads and polls of the manager overview
 * integration tests (docs/specs/079-manager-shell-and-overview.md) through the real repositories,
 * and removes everything it created ({@link #cleanUp}) because those tests are deliberately not
 * {@code @Transactional}. Shared by the controller test and the statement-count guard so the two
 * seed the same shapes.
 */
public final class ManagerOverviewFixtures {

    /** One club with a Seniors and a Juniors section, two Seniors teams and one Juniors team. */
    public record World(Club club, Season season, Section seniors, Section juniors, Team seniors1, Team seniors2,
            Team juniorsTeam) {
    }

    private final ClubRepository clubRepository;
    private final SeasonRepository seasonRepository;
    private final SectionRepository sectionRepository;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;
    private final MatchRepository matchRepository;
    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final PersonRepository personRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final MatchAvailabilityPollRepository pollRepository;
    private final PlayerAvailabilityRepository playerAvailabilityRepository;
    private final SectionAvailabilityRoundRepository roundRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityResponseRepository responseRepository;
    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;
    private final JdbcTemplate jdbcTemplate;

    private final List<UUID> clubIds = new ArrayList<>();
    private final List<UUID> personIds = new ArrayList<>();
    private int windowCounter;

    public ManagerOverviewFixtures(ApplicationContext ctx) {
        clubRepository = ctx.getBean(ClubRepository.class);
        seasonRepository = ctx.getBean(SeasonRepository.class);
        sectionRepository = ctx.getBean(SectionRepository.class);
        teamRepository = ctx.getBean(TeamRepository.class);
        leagueRepository = ctx.getBean(LeagueRepository.class);
        matchRepository = ctx.getBean(MatchRepository.class);
        matchSideRepository = ctx.getBean(MatchSideRepository.class);
        matchSidePlayerRepository = ctx.getBean(MatchSidePlayerRepository.class);
        teamSquadMemberRepository = ctx.getBean(TeamSquadMemberRepository.class);
        personRepository = ctx.getBean(PersonRepository.class);
        playerProfileRepository = ctx.getBean(PlayerProfileRepository.class);
        playerSectionRepository = ctx.getBean(PlayerSectionRepository.class);
        roleAssignmentRepository = ctx.getBean(RoleAssignmentRepository.class);
        pollRepository = ctx.getBean(MatchAvailabilityPollRepository.class);
        playerAvailabilityRepository = ctx.getBean(PlayerAvailabilityRepository.class);
        roundRepository = ctx.getBean(SectionAvailabilityRoundRepository.class);
        windowRepository = ctx.getBean(SectionAvailabilityWindowRepository.class);
        responseRepository = ctx.getBean(SectionAvailabilityResponseRepository.class);
        windowMatchRepository = ctx.getBean(SectionAvailabilityWindowMatchRepository.class);
        jdbcTemplate = ctx.getBean(JdbcTemplate.class);
    }

    public World world() {
        String slug = "overview-" + UUID.randomUUID();
        Club club = clubRepository.save(Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
        clubIds.add(club.getId());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2031")
                .startDate(LocalDate.of(2031, 1, 1)).endDate(LocalDate.of(2031, 12, 31)).active(true).build());
        Section seniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Seniors").active(true).build());
        Section juniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        return new World(club, season, seniors, juniors,
                team(club, seniors, "Villagers 1"), team(club, seniors, "Villagers 2"), team(club, juniors, "U15 A"));
    }

    public Team team(Club club, Section section, String name) {
        return teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId()).name(name)
                .active(true).build());
    }

    public League league(World w, int maxPlayingXiSize) {
        return leagueRepository.save(League.builder().clubId(w.club().getId()).name("League " + UUID.randomUUID())
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(maxPlayingXiSize).active(true).build());
    }

    /** An active match of {@code home} against {@code away} (a free-text "Occasionals" when null). */
    public Match match(World w, Team home, Team away, Instant when) {
        return match(w, home, away, when, true, null);
    }

    public Match match(World w, Team home, Team away, Instant when, boolean active, League league) {
        return matchRepository.save(Match.builder().clubId(w.club().getId()).homeTeamId(home.getId())
                .awayTeamId(away == null ? null : away.getId()).awayTeamName(away == null ? "Occasionals" : null)
                .leagueId(league == null ? null : league.getId())
                .seasonId(w.season().getId()).matchDate(when).venue("Ground").active(active).build());
    }

    public PlayerProfile player(World w, String firstName, boolean active) {
        Person person = personRepository.save(Person.builder().firstName(firstName).lastName("Player")
                .dateOfBirth(LocalDate.of(1995, 1, 1)).build());
        personIds.add(person.getId());
        return playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(w.club().getId()).active(active).build());
    }

    public PlayerProfile rosterPlayer(World w, Team team, String firstName) {
        PlayerProfile profile = player(w, firstName, true);
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(team.getId())
                .seasonId(w.season().getId()).playerProfileId(profile.getId()).build());
        return profile;
    }

    public void tag(Section section, PlayerProfile profile) {
        playerSectionRepository.save(
                PlayerSection.builder().playerProfileId(profile.getId()).sectionId(section.getId()).build());
    }

    public MatchSide side(Match match, Team team, boolean announced, PlayerProfile... players) {
        MatchSide side = matchSideRepository.save(
                MatchSide.builder().matchId(match.getId()).teamId(team.getId()).announced(announced).build());
        for (int i = 0; i < players.length; i++) {
            matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId())
                    .playerProfileId(players[i].getId()).battingOrder(i + 1).role(PlayingRole.BATSMAN).build());
        }
        return side;
    }

    public MatchAvailabilityPoll squadPoll(Match match, Team team, Instant closeAt, PlayerProfile... answered) {
        MatchAvailabilityPoll poll = pollRepository.save(MatchAvailabilityPoll.builder().matchId(match.getId())
                .teamId(team.getId()).open(true).scheduledCloseAt(closeAt).build());
        for (PlayerProfile player : answered) {
            playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId())
                    .playerProfileId(player.getId()).status(AvailabilityStatus.AVAILABLE).build());
        }
        return poll;
    }

    /** An open group poll of {@code section} with one window that {@code answered} have answered. */
    public SectionAvailabilityRound groupPoll(World w, Section section, Instant closeAt, PlayerProfile... answered) {
        // one window per (section, date, day part) is unique, so each poll gets its own date
        LocalDate date = LocalDate.now().plusDays(windowCounter++);
        SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder()
                .clubId(w.club().getId()).sectionId(section.getId()).description("Weekend " + section.getName())
                .firstMatchDate(date).lastMatchDate(date).autoClose(false)
                .scheduledCloseAt(closeAt).open(true).build());
        SectionAvailabilityWindow window = windowRepository.save(SectionAvailabilityWindow.builder()
                .clubId(w.club().getId()).sectionId(section.getId()).roundId(round.getId())
                .windowDate(date).dayPart(DayPart.MORNING).open(true).build());
        for (PlayerProfile player : answered) {
            responseRepository.save(SectionAvailabilityResponse.builder().windowId(window.getId())
                    .playerProfileId(player.getId()).status(AvailabilityStatus.AVAILABLE).build());
        }
        return round;
    }

    /** Puts {@code match} in the (only) window of {@code round}, as a fixture slot of the group poll. */
    public void linkMatch(SectionAvailabilityRound round, Match match) {
        SectionAvailabilityWindow window = windowRepository.findByRoundIdIn(List.of(round.getId())).get(0);
        windowMatchRepository.save(
                SectionAvailabilityWindowMatch.builder().windowId(window.getId()).matchId(match.getId()).build());
    }

    public void closeSquadPoll(MatchAvailabilityPoll poll) {
        jdbcTemplate.update("update match_availability_poll set open = false where id = ?", poll.getId());
    }

    public void closeGroupPoll(SectionAvailabilityRound round) {
        jdbcTemplate.update("update section_availability_round set open = false where id = ?", round.getId());
    }

    public JwtRequestPostProcessor clubAdmin(World w) {
        return grant(ScopeType.CLUB, w.club().getId());
    }

    public JwtRequestPostProcessor sectionManager(Section section) {
        return grant(ScopeType.SECTION, section.getId());
    }

    /** A signed-in person with no role assignment at all. */
    public JwtRequestPostProcessor nobody() {
        return withSubject(createPerson(null, null).getKeycloakUserId());
    }

    /** The Keycloak subject of a new person holding a SECTION-scope grant, for service-level callers. */
    public String sectionManagerSubject(Section section) {
        return createPerson(ScopeType.SECTION, section.getId()).getKeycloakUserId();
    }

    private JwtRequestPostProcessor grant(ScopeType scopeType, UUID scopeId) {
        return withSubject(createPerson(scopeType, scopeId).getKeycloakUserId());
    }

    private Person createPerson(ScopeType scopeType, UUID scopeId) {
        String subject = "sub-" + UUID.randomUUID();
        Person person = personRepository.save(Person.builder().firstName("Casey").lastName("Manager")
                .email(subject + "@example.com").keycloakUserId(subject).build());
        personIds.add(person.getId());
        if (scopeType != null) {
            roleAssignmentRepository.save(RoleAssignment.builder().personId(person.getId())
                    .role(RoleAssignmentRole.CLUB_ADMIN).scopeType(scopeType).scopeId(scopeId).build());
        }
        return person;
    }

    public void cleanUp() {
        if (clubIds.isEmpty()) {
            return;
        }
        String clubs = clubIds.stream().map(id -> "'" + id + "'").collect(Collectors.joining(","));
        String persons = personIds.isEmpty()
                ? "null"
                : personIds.stream().map(id -> "'" + id + "'").collect(Collectors.joining(","));
        String matches = "select id from match where club_id in (" + clubs + ")";
        String windows = "select id from section_availability_window where club_id in (" + clubs + ")";
        String polls = "select id from match_availability_poll where match_id in (" + matches + ")";
        String sides = "select id from match_side where match_id in (" + matches + ")";
        for (String sql : List.of(
                "delete from match_side_player where match_side_id in (" + sides + ")",
                "delete from match_side where match_id in (" + matches + ")",
                "delete from player_availability where poll_id in (" + polls + ")",
                "delete from match_availability_poll where match_id in (" + matches + ")",
                "delete from section_availability_response where window_id in (" + windows + ")",
                "delete from section_availability_window_match where window_id in (" + windows + ")",
                "delete from match where club_id in (" + clubs + ")",
                "delete from section_availability_window where club_id in (" + clubs + ")",
                "delete from section_availability_round where club_id in (" + clubs + ")",
                "delete from team_squad_member where team_id in (select id from team where club_id in (" + clubs + "))",
                "delete from player_section where section_id in (select id from section where club_id in (" + clubs + "))",
                "delete from role_assignment where person_id in (" + persons + ")",
                "delete from player_profile where club_id in (" + clubs + ")",
                "delete from person where id in (" + persons + ")",
                "delete from league where club_id in (" + clubs + ")",
                "delete from team where club_id in (" + clubs + ")",
                "update section set parent_section_id = null where club_id in (" + clubs + ")",
                "delete from section where club_id in (" + clubs + ")",
                "delete from season where club_id in (" + clubs + ")",
                "delete from club where id in (" + clubs + ")")) {
            jdbcTemplate.update(sql);
        }
        clubIds.clear();
        personIds.clear();
    }
}
