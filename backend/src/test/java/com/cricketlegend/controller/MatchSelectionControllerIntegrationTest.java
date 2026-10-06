package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
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
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
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
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.SelectionLockRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.support.MatchSlots;
import com.cricketlegend.service.support.TakenBy;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Integration test for the team-selection endpoints of docs/specs/076-team-selection.md (Test Plan:
 * Backend integration and Access rules) against a real Postgres: the pool for the three coverage
 * kinds, the atomic apply (200, a 409 body carrying {@code rejections}, 403 for another section),
 * the release path ({@code remove?keepAnnounced}), the advisory-lock race (two concurrent applies
 * for one player: one succeeds, one gets 409), the window query behind the slot rule, and a
 * section-scoped manager's reach.
 *
 * <p>Deliberately NOT {@code @Transactional} (docs/standards/backend.md): the race needs two real
 * committed transactions, and a rolled-back test transaction would hide what a second request sees.
 * Every test builds its own club (unique slug) and {@link #cleanUp()} removes everything it created.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MatchSelectionControllerIntegrationTest {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private static final String POOL = "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/selection-pool";
    private static final String SELECTION = "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/selection";
    private static final String REMOVE =
            "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/{playerId}/remove";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private SelectionLockRepository selectionLockRepository;

    @Autowired
    private MatchSlots matchSlots;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private MatchSideRepository matchSideRepository;

    @Autowired
    private MatchSidePlayerRepository matchSidePlayerRepository;

    @Autowired
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private PlayerSectionRepository playerSectionRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Autowired
    private MatchAvailabilityPollRepository pollRepository;

    @Autowired
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Autowired
    private SectionAvailabilityRoundRepository roundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository windowRepository;

    @Autowired
    private SectionAvailabilityWindowMatchRepository windowMatchRepository;

    @Autowired
    private SectionAvailabilityResponseRepository responseRepository;

    private final List<UUID> clubIds = new ArrayList<>();
    private final List<UUID> personIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
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

    // --- fixtures ---

    /** One club with two sections (Seniors, Juniors), two Seniors teams and one Juniors team. */
    private record World(Club club, Season season, Section seniors, Section juniors, Team seniors1, Team seniors2,
            Team juniorsTeam) {
    }

    private World world() {
        String slug = "riverside-" + UUID.randomUUID();
        Club club = clubRepository.save(Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
        clubIds.add(club.getId());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2031")
                .startDate(LocalDate.of(2031, 1, 1)).endDate(LocalDate.of(2031, 12, 31)).active(true).build());
        Section seniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Seniors").active(true).build());
        Section juniors = sectionRepository.save(Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        return new World(club, season, seniors, juniors,
                team(club, seniors, "Villagers 1"), team(club, seniors, "Villagers 2"), team(club, juniors, "U15 A"));
    }

    private Team team(Club club, Section section, String name) {
        return teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId()).name(name)
                .active(true).build());
    }

    private static Instant at(int day, int hour) {
        return LocalDateTime.of(LocalDate.of(2031, 6, 7).plusDays(day), java.time.LocalTime.of(hour, 0))
                .atZone(ZONE).toInstant();
    }

    private Match match(World w, Team home, Team away, Instant when) {
        return matchRepository.save(Match.builder().clubId(w.club().getId()).homeTeamId(home.getId())
                .awayTeamId(away == null ? null : away.getId()).awayTeamName(away == null ? "Occasionals" : null)
                .seasonId(w.season().getId()).matchDate(when).active(true).build());
    }

    private PlayerProfile player(World w, String firstName) {
        Person person = personRepository.save(Person.builder().firstName(firstName).lastName("Player")
                .dateOfBirth(LocalDate.of(1995, 1, 1)).build());
        personIds.add(person.getId());
        return playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(w.club().getId()).active(true).build());
    }

    private PlayerProfile rosterPlayer(World w, Team team, String firstName) {
        PlayerProfile profile = player(w, firstName);
        teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(team.getId())
                .seasonId(w.season().getId()).playerProfileId(profile.getId()).build());
        return profile;
    }

    private void tag(Section section, PlayerProfile profile) {
        playerSectionRepository.save(
                PlayerSection.builder().playerProfileId(profile.getId()).sectionId(section.getId()).build());
    }

    private MatchSide side(Match match, Team team) {
        return matchSideRepository.save(MatchSide.builder().matchId(match.getId()).teamId(team.getId()).build());
    }

    private MatchSide sideWith(Match match, Team team, PlayerProfile... players) {
        MatchSide side = side(match, team);
        for (int i = 0; i < players.length; i++) {
            matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId())
                    .playerProfileId(players[i].getId()).battingOrder(i + 1).role(PlayingRole.BATSMAN).build());
        }
        return side;
    }

    private JwtRequestPostProcessor clubAdmin(World w) {
        return grant(w.club().getId(), ScopeType.CLUB, w.club().getId());
    }

    private JwtRequestPostProcessor sectionManager(World w, Section section) {
        return grant(w.club().getId(), ScopeType.SECTION, section.getId());
    }

    private JwtRequestPostProcessor grant(UUID clubId, ScopeType scopeType, UUID scopeId) {
        String subject = "sub-" + UUID.randomUUID();
        Person person = personRepository.save(Person.builder().firstName("Casey").lastName("Manager")
                .email(subject + "@example.com").keycloakUserId(subject).build());
        personIds.add(person.getId());
        roleAssignmentRepository.save(RoleAssignment.builder().personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN).scopeType(scopeType).scopeId(scopeId).build());
        return withSubject(subject);
    }

    private String applyBody(Object... entries) {
        StringBuilder body = new StringBuilder("{\"players\": [");
        for (int i = 0; i < entries.length; i++) {
            if (i > 0) {
                body.append(',');
            }
            body.append(entries[i]);
        }
        return body.append("]}").toString();
    }

    private String entry(PlayerProfile player) {
        return "{\"playerProfileId\": \"" + player.getId() + "\"}";
    }

    private String entry(PlayerProfile player, String role, Integer battingOrder) {
        return "{\"playerProfileId\": \"" + player.getId() + "\", \"role\": \"" + role + "\", \"battingOrder\": "
                + battingOrder + "}";
    }

    private org.springframework.test.web.servlet.ResultActions apply(
            JwtRequestPostProcessor caller, World w, Match match, MatchSide side, String body) throws Exception {
        return mockMvc.perform(put(SELECTION, w.club().getId(), match.getId(), side.getId())
                .with(caller).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private String pool(JwtRequestPostProcessor caller, World w, Match match, Team team, String query)
            throws Exception {
        return mockMvc.perform(get(POOL + query, w.club().getId(), match.getId(), team.getId()).with(caller))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private Map<String, Object> poolEntry(String body, PlayerProfile player) {
        List<Map<String, Object>> found =
                JsonPath.read(body, "$.entries[?(@.playerProfileId=='" + player.getId() + "')]");
        assertThat(found).as("pool entry for %s", player.getId()).hasSize(1);
        return found.get(0);
    }

    private List<UUID> poolIds(String body) {
        List<String> ids = JsonPath.read(body, "$.entries[*].playerProfileId");
        return ids.stream().map(UUID::fromString).toList();
    }

    private List<MatchSidePlayer> rows(MatchSide side) {
        return matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(side.getId());
    }

    // --- apply ---

    @Test
    void applyAddsPlayersWaitingWithoutAPositionThenPositionsThemOnAReApply() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        MatchSide side = side(match, w.seniors1());
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        PlayerProfile bob = rosterPlayer(w, w.seniors1(), "Bob");
        JwtRequestPostProcessor admin = clubAdmin(w);

        apply(admin, w, match, side, applyBody(entry(ann, "BOWLER", null), entry(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players", hasSize(2)))
                .andExpect(jsonPath("$.players[?(@.playerProfileId=='" + ann.getId() + "')].role").value("BOWLER"))
                .andExpect(jsonPath("$.players[0].battingOrder").value(nullValue()))
                .andExpect(jsonPath("$.players[0].firstName").exists())
                .andExpect(jsonPath("$.limits.battingPlaces").value(11))
                .andExpect(jsonPath("$.limits.maxSelected").value(12));

        apply(admin, w, match, side, applyBody(entry(bob, "BATSMAN", 1), entry(ann, "BOWLER", 2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[0].playerProfileId").value(bob.getId().toString()))
                .andExpect(jsonPath("$.players[0].battingOrder").value(1))
                .andExpect(jsonPath("$.players[1].battingOrder").value(2));
        assertThat(rows(side)).extracting(MatchSidePlayer::getBattingOrder).containsExactly(1, 2);
    }

    @Test
    void applyIsIdempotentAndRemovesAndClearsPointers() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        PlayerProfile bob = rosterPlayer(w, w.seniors1(), "Bob");
        MatchSide side = sideWith(match, w.seniors1(), ann, bob);
        side.setCaptainPlayerId(bob.getId());
        side.setAnnounced(true);
        matchSideRepository.save(side);
        JwtRequestPostProcessor admin = clubAdmin(w);

        apply(admin, w, match, side, applyBody(entry(ann), entry(bob))).andExpect(status().isOk());
        apply(admin, w, match, side, applyBody(entry(ann), entry(bob))).andExpect(status().isOk());
        assertThat(rows(side)).extracting(MatchSidePlayer::getPlayerProfileId)
                .containsExactly(ann.getId(), bob.getId());
        assertThat(matchSideRepository.findById(side.getId()).orElseThrow().isAnnounced()).isFalse();

        apply(admin, w, match, side, applyBody(entry(ann)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.captainPlayerId").value(nullValue()))
                .andExpect(jsonPath("$.players", hasSize(1)));
        apply(admin, w, match, side, applyBody()).andExpect(status().isOk()).andExpect(jsonPath("$.players", hasSize(0)));
        assertThat(rows(side)).isEmpty();
    }

    @Test
    void applyWithAPlayerHeldByAnotherTeamInTheSameSlotIs409WithRejectionsAndSavesNothing() throws Exception {
        World w = world();
        Match mine = match(w, w.seniors1(), null, at(0, 9));
        Match theirs = match(w, w.seniors2(), null, at(0, 10));
        MatchSide mySide = side(mine, w.seniors1());
        PlayerProfile liam = rosterPlayer(w, w.seniors1(), "Liam");
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        sideWith(theirs, w.seniors2(), liam);

        apply(clubAdmin(w), w, mine, mySide, applyBody(entry(ann), entry(liam)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("1 player can't be selected"))
                .andExpect(jsonPath("$.rejections", hasSize(1)))
                .andExpect(jsonPath("$.rejections[0].playerProfileId").value(liam.getId().toString()))
                .andExpect(jsonPath("$.rejections[0].reason").value("TAKEN_FOR_SLOT"))
                .andExpect(jsonPath("$.rejections[0].taken.teamName").value("Villagers 2"))
                .andExpect(jsonPath("$.rejections[0].taken.canRelease").value(true));
        assertThat(rows(mySide)).isEmpty();
    }

    @Test
    void aMorningSelectionDoesNotBlockTheSamePlayerInTheAfternoon() throws Exception {
        World w = world();
        Match morning = match(w, w.seniors2(), null, at(0, 9));
        Match afternoon = match(w, w.seniors1(), null, at(0, 14));
        MatchSide afternoonSide = side(afternoon, w.seniors1());
        PlayerProfile liam = rosterPlayer(w, w.seniors1(), "Liam");
        sideWith(morning, w.seniors2(), liam);

        apply(clubAdmin(w), w, afternoon, afternoonSide, applyBody(entry(liam))).andExpect(status().isOk());
    }

    @Test
    void applyReportsEveryRejectionAndTeamFullAsAWholeRequestReason() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        MatchSide side = side(match, w.seniors1());
        PlayerProfile stranger = player(w, "Stranger");
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        List<String> entries = new ArrayList<>(List.of(entry(stranger), entry(ann)));
        for (int i = 0; i < 11; i++) {
            entries.add(entry(rosterPlayer(w, w.seniors1(), "Filler" + i)));
        }

        apply(clubAdmin(w), w, match, side, applyBody(entries.toArray()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.rejections[?(@.reason=='TEAM_FULL')]", hasSize(1)))
                .andExpect(jsonPath("$.rejections[?(@.reason=='NOT_IN_POOL')].playerProfileId")
                        .value(stranger.getId().toString()));
        assertThat(rows(side)).isEmpty();
    }

    @Test
    void applyWithTheSamePlayerTwiceIs400AndAnUnknownSideIs404() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        MatchSide side = side(match, w.seniors1());
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        JwtRequestPostProcessor admin = clubAdmin(w);

        apply(admin, w, match, side, applyBody(entry(ann), entry(ann))).andExpect(status().isBadRequest());
        mockMvc.perform(put(SELECTION, w.club().getId(), match.getId(), UUID.randomUUID())
                        .with(admin).contentType(MediaType.APPLICATION_JSON).content(applyBody()))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(SELECTION, w.club().getId(), match.getId(), side.getId())
                        .with(admin).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    // --- two concurrent applies for one player ---

    @Test
    void twoConcurrentAppliesForOnePlayerInTheSameSlotSucceedOnceAndConflictOnce() throws Exception {
        World w = world();
        JwtRequestPostProcessor admin = clubAdmin(w);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 3; round++) {
                Match one = match(w, w.seniors1(), null, at(round * 7, 9));
                Match two = match(w, w.seniors2(), null, at(round * 7, 9));
                MatchSide sideOne = side(one, w.seniors1());
                MatchSide sideTwo = side(two, w.seniors2());
                PlayerProfile contested = rosterPlayer(w, w.seniors1(), "Contested" + round);
                teamSquadMemberRepository.save(TeamSquadMember.builder().teamId(w.seniors2().getId())
                        .seasonId(w.season().getId()).playerProfileId(contested.getId()).build());
                CyclicBarrier startTogether = new CyclicBarrier(2);

                Future<Integer> first = pool.submit(() -> {
                    startTogether.await();
                    return apply(admin, w, one, sideOne, applyBody(entry(contested))).andReturn().getResponse().getStatus();
                });
                Future<Integer> second = pool.submit(() -> {
                    startTogether.await();
                    return apply(admin, w, two, sideTwo, applyBody(entry(contested))).andReturn().getResponse().getStatus();
                });

                assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                        .containsExactlyInAnyOrder(200, 409);
                long selections = rows(sideOne).size() + rows(sideTwo).size();
                assertThat(selections).as("rows holding the contested player in round %d", round).isEqualTo(1);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    // --- SelectionLockRepository ---

    @Test
    void theAdvisoryLockMakesASecondTransactionWaitUntilTheFirstCommits() throws Exception {
        UUID playerId = UUID.randomUUID();
        TransactionTemplate transactions = new TransactionTemplate(transactionManager);
        CountDownLatch firstHoldsLock = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CountDownLatch secondHasLock = new CountDownLatch(1);
        ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = threads.submit(() -> transactions.executeWithoutResult(status -> {
                assertThat(selectionLockRepository.lockPlayer(playerId)).isEqualTo(1);
                firstHoldsLock.countDown();
                try {
                    releaseFirst.await(30, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(firstHoldsLock.await(30, TimeUnit.SECONDS)).isTrue();
            Future<?> second = threads.submit(() -> transactions.executeWithoutResult(status -> {
                selectionLockRepository.lockPlayer(playerId);
                secondHasLock.countDown();
            }));

            assertThat(secondHasLock.await(750, TimeUnit.MILLISECONDS))
                    .as("the second transaction must wait while the first holds the lock").isFalse();
            releaseFirst.countDown();
            first.get(30, TimeUnit.SECONDS);
            second.get(30, TimeUnit.SECONDS);
            assertThat(secondHasLock.getCount()).isZero();
        } finally {
            releaseFirst.countDown();
            threads.shutdownNow();
        }
    }

    @Test
    void locksForDifferentPlayersDoNotBlockEachOther() throws Exception {
        TransactionTemplate transactions = new TransactionTemplate(transactionManager);
        CountDownLatch firstHoldsLock = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            threads.submit(() -> transactions.executeWithoutResult(status -> {
                selectionLockRepository.lockPlayer(UUID.randomUUID());
                firstHoldsLock.countDown();
                try {
                    releaseFirst.await(30, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(firstHoldsLock.await(30, TimeUnit.SECONDS)).isTrue();

            Future<?> other = threads.submit(
                    () -> transactions.executeWithoutResult(status -> selectionLockRepository.lockPlayer(UUID.randomUUID())));

            other.get(10, TimeUnit.SECONDS);
        } finally {
            releaseFirst.countDown();
            threads.shutdownNow();
        }
    }

    // --- the window query behind the slot rule ---

    @Test
    void matchSlotsIgnoresAnotherClubsMatchAndADeactivatedMatchButSeesTheClubsOwn() {
        World w = world();
        World otherClub = world();
        Match mine = match(w, w.seniors1(), null, at(0, 9));
        PlayerProfile liam = rosterPlayer(w, w.seniors1(), "Liam");

        Match foreign = match(otherClub, otherClub.seniors1(), null, at(0, 9));
        sideWith(foreign, otherClub.seniors1(), liam);
        Match deactivated = match(w, w.seniors2(), null, at(0, 9));
        deactivated.setActive(false);
        matchRepository.save(deactivated);
        sideWith(deactivated, w.seniors2(), liam);

        assertThat(matchSlots.taken(mine, w.seniors1().getId(), Set.of(liam.getId()))).isEmpty();

        Match live = match(w, w.seniors2(), null, at(0, 10));
        sideWith(live, w.seniors2(), liam);

        Map<UUID, TakenBy> taken = matchSlots.taken(mine, w.seniors1().getId(), Set.of(liam.getId()));
        assertThat(taken).containsOnlyKeys(liam.getId());
        assertThat(taken.get(liam.getId()).matchId()).isEqualTo(live.getId());
    }

    // --- pool: the three coverage kinds ---

    @Test
    void poolWithoutAPollIsTheRosterWithEveryoneNotPolledAndWholeSectionAddsTheTaggedPlayers() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        PlayerProfile bob = player(w, "Bob");
        tag(w.seniors(), bob);
        PlayerProfile juniorOnly = player(w, "Zoe");
        tag(w.juniors(), juniorOnly);
        JwtRequestPostProcessor admin = clubAdmin(w);

        String defaultPool = pool(admin, w, match, w.seniors1(), "");
        assertThat((String) JsonPath.read(defaultPool, "$.basis")).isEqualTo("ROSTER");
        assertThat((String) JsonPath.read(defaultPool, "$.coveringPoll.kind")).isEqualTo("NONE");
        assertThat(poolIds(defaultPool)).containsExactly(ann.getId());
        assertThat(poolEntry(defaultPool, ann).get("availability")).isEqualTo("NOT_POLLED");
        assertThat(poolEntry(defaultPool, ann).get("selectable")).isEqualTo(true);

        String whole = pool(admin, w, match, w.seniors1(), "?wholeSection=true");
        assertThat(poolIds(whole)).containsExactlyInAnyOrder(ann.getId(), bob.getId());
        assertThat(poolIds(pool(admin, w, match, w.seniors1(), "?wholeSection=true&q=BO"))).containsExactly(bob.getId());
    }

    @Test
    void poolWithASquadPollReadsEachPlayersAnswerAndRejectsAllButAvailable() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        PlayerProfile yes = rosterPlayer(w, w.seniors1(), "Aaron");
        PlayerProfile maybe = rosterPlayer(w, w.seniors1(), "Barry");
        PlayerProfile no = rosterPlayer(w, w.seniors1(), "Carl");
        PlayerProfile silent = rosterPlayer(w, w.seniors1(), "Dave");
        MatchAvailabilityPoll poll = pollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(w.seniors1().getId()).open(true).build());
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId())
                .playerProfileId(yes.getId()).status(AvailabilityStatus.AVAILABLE).build());
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId())
                .playerProfileId(maybe.getId()).status(AvailabilityStatus.UNSURE).build());
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId())
                .playerProfileId(no.getId()).status(AvailabilityStatus.UNAVAILABLE).build());

        String body = pool(clubAdmin(w), w, match, w.seniors1(), "");

        assertThat((String) JsonPath.read(body, "$.coveringPoll.kind")).isEqualTo("SQUAD");
        assertThat((String) JsonPath.read(body, "$.coveringPoll.pollId")).isEqualTo(poll.getId().toString());
        assertThat(poolEntry(body, yes)).containsEntry("availability", "AVAILABLE").containsEntry("selectable", true);
        assertThat(poolEntry(body, maybe)).containsEntry("availability", "UNSURE").containsEntry("reason", "NOT_CONFIRMED");
        assertThat(poolEntry(body, no)).containsEntry("availability", "UNAVAILABLE").containsEntry("reason", "SAID_UNAVAILABLE");
        assertThat(poolEntry(body, silent)).containsEntry("availability", "NO_RESPONSE").containsEntry("reason", "NOT_CONFIRMED");
        assertThat(poolIds(body)).containsExactly(yes.getId(), maybe.getId(), no.getId(), silent.getId());
    }

    @Test
    void poolWithAGroupPollDefaultsToTheYesSayersAndWholeSectionShowsThoseStillToAnswer() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        PlayerProfile yesAndTagged = rosterPlayer(w, w.seniors1(), "Aaron");
        PlayerProfile yesRosterOnly = rosterPlayer(w, w.seniors1(), "Barry");
        PlayerProfile unsureTagged = player(w, "Carl");
        PlayerProfile silentTagged = player(w, "Dave");
        tag(w.seniors(), yesAndTagged);
        tag(w.seniors(), unsureTagged);
        tag(w.seniors(), silentTagged);
        SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder()
                .clubId(w.club().getId()).sectionId(w.seniors().getId()).description("Round 1")
                .firstMatchDate(LocalDate.of(2031, 6, 7)).lastMatchDate(LocalDate.of(2031, 6, 7)).open(true).build());
        SectionAvailabilityWindow window = windowRepository.save(SectionAvailabilityWindow.builder()
                .clubId(w.club().getId()).sectionId(w.seniors().getId()).roundId(round.getId())
                .windowDate(LocalDate.of(2031, 6, 7)).dayPart(DayPart.MORNING).open(true).build());
        windowMatchRepository.save(
                SectionAvailabilityWindowMatch.builder().windowId(window.getId()).matchId(match.getId()).build());
        responseRepository.save(SectionAvailabilityResponse.builder().windowId(window.getId())
                .playerProfileId(yesAndTagged.getId()).status(AvailabilityStatus.AVAILABLE).build());
        responseRepository.save(SectionAvailabilityResponse.builder().windowId(window.getId())
                .playerProfileId(yesRosterOnly.getId()).status(AvailabilityStatus.AVAILABLE).build());
        responseRepository.save(SectionAvailabilityResponse.builder().windowId(window.getId())
                .playerProfileId(unsureTagged.getId()).status(AvailabilityStatus.UNSURE).build());
        JwtRequestPostProcessor admin = clubAdmin(w);

        String defaultPool = pool(admin, w, match, w.seniors1(), "");

        assertThat((String) JsonPath.read(defaultPool, "$.basis")).isEqualTo("POLL_AVAILABLE");
        assertThat((String) JsonPath.read(defaultPool, "$.coveringPoll.kind")).isEqualTo("GROUP");
        assertThat((String) JsonPath.read(defaultPool, "$.coveringPoll.roundId")).isEqualTo(round.getId().toString());
        assertThat(poolIds(defaultPool)).containsExactly(yesAndTagged.getId(), yesRosterOnly.getId());

        String whole = pool(admin, w, match, w.seniors1(), "?wholeSection=true");
        assertThat(poolIds(whole)).containsExactlyInAnyOrder(
                yesAndTagged.getId(), yesRosterOnly.getId(), unsureTagged.getId(), silentTagged.getId());
        assertThat(poolEntry(whole, unsureTagged)).containsEntry("reason", "NOT_CONFIRMED");
        assertThat(poolEntry(whole, silentTagged)).containsEntry("availability", "NO_RESPONSE");
    }

    @Test
    void poolListsSelectedPlayersEvenOffTheDefaultPoolAndMarksThemSelected() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        PlayerProfile offPool = player(w, "Zed");
        sideWith(match, w.seniors1(), offPool);

        String body = pool(clubAdmin(w), w, match, w.seniors1(), "?q=ann");

        assertThat(poolIds(body)).containsExactlyInAnyOrder(ann.getId(), offPool.getId());
        assertThat(poolEntry(body, offPool)).containsEntry("selected", true).containsEntry("selectable", true);
        assertThat(poolEntry(body, ann)).containsEntry("selected", false);
    }

    @Test
    void poolForATeamThatIsNotOnTheMatchIs400() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));

        mockMvc.perform(get(POOL, w.club().getId(), match.getId(), w.seniors2().getId()).with(clubAdmin(w)))
                .andExpect(status().isBadRequest());
    }

    // --- access rules and canRelease ---

    @Test
    void canReleaseIsTrueOnlyForTeamsInTheCallersSectionTree() throws Exception {
        World w = world();
        Match mine = match(w, w.seniors1(), null, at(0, 9));
        Match heldInSeniors = match(w, w.seniors2(), null, at(0, 10));
        Match heldInJuniors = match(w, w.juniorsTeam(), null, at(0, 9));
        PlayerProfile inSeniors = rosterPlayer(w, w.seniors1(), "Sam");
        PlayerProfile inJuniors = rosterPlayer(w, w.seniors1(), "Jay");
        sideWith(heldInSeniors, w.seniors2(), inSeniors);
        sideWith(heldInJuniors, w.juniorsTeam(), inJuniors);

        String asSeniorsManager = pool(sectionManager(w, w.seniors()), w, mine, w.seniors1(), "");
        String asClubAdmin = pool(clubAdmin(w), w, mine, w.seniors1(), "");

        assertThat(((Map<String, Object>) poolEntry(asSeniorsManager, inSeniors).get("taken"))).containsEntry("canRelease", true);
        assertThat(((Map<String, Object>) poolEntry(asSeniorsManager, inJuniors).get("taken"))).containsEntry("canRelease", false);
        assertThat(((Map<String, Object>) poolEntry(asClubAdmin, inJuniors).get("taken"))).containsEntry("canRelease", true);
    }

    @Test
    void aSectionManagerHasPoolAndApplyOnHisOwnSectionsMatchAndIs403OnAnothers() throws Exception {
        World w = world();
        Match seniorsMatch = match(w, w.seniors1(), null, at(0, 9));
        Match juniorsMatch = match(w, w.juniorsTeam(), null, at(1, 9));
        MatchSide seniorsSide = side(seniorsMatch, w.seniors1());
        MatchSide juniorsSide = side(juniorsMatch, w.juniorsTeam());
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        PlayerProfile kid = rosterPlayer(w, w.juniorsTeam(), "Kid");
        JwtRequestPostProcessor seniorsManager = sectionManager(w, w.seniors());

        pool(seniorsManager, w, seniorsMatch, w.seniors1(), "");
        apply(seniorsManager, w, seniorsMatch, seniorsSide, applyBody(entry(ann))).andExpect(status().isOk());

        mockMvc.perform(get(POOL, w.club().getId(), juniorsMatch.getId(), w.juniorsTeam().getId()).with(seniorsManager))
                .andExpect(status().isForbidden());
        apply(seniorsManager, w, juniorsMatch, juniorsSide, applyBody(entry(kid))).andExpect(status().isForbidden());
        assertThat(rows(juniorsSide)).isEmpty();
        // a club admin reaches everything
        apply(clubAdmin(w), w, juniorsMatch, juniorsSide, applyBody(entry(kid))).andExpect(status().isOk());
    }

    @Test
    void aManagerOfAnotherClubIs403() throws Exception {
        World w = world();
        World other = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        MatchSide side = side(match, w.seniors1());

        mockMvc.perform(get(POOL, w.club().getId(), match.getId(), w.seniors1().getId()).with(clubAdmin(other)))
                .andExpect(status().isForbidden());
        apply(clubAdmin(other), w, match, side, applyBody()).andExpect(status().isForbidden());
    }

    /** Pins today's behaviour (spec 076 Access rules): the "any of the match's sections" rule lets the home section's manager edit the away side of an in-club derby. */
    @Test
    void aHomeSectionManagerMayApplyToTheAwaySideOfAnInClubDerby() throws Exception {
        World w = world();
        Match derby = match(w, w.seniors1(), w.juniorsTeam(), at(0, 9));
        MatchSide awaySide = side(derby, w.juniorsTeam());
        PlayerProfile kid = rosterPlayer(w, w.juniorsTeam(), "Kid");

        apply(sectionManager(w, w.seniors()), w, derby, awaySide, applyBody(entry(kid))).andExpect(status().isOk());
    }

    @Test
    void releaseIsForbiddenOnAMatchWithNoSectionOfTheManagersAndAllowedOnHisOwn() throws Exception {
        World w = world();
        Match juniorsMatch = match(w, w.juniorsTeam(), null, at(0, 9));
        Match seniorsMatch = match(w, w.seniors1(), null, at(1, 9));
        PlayerProfile kid = rosterPlayer(w, w.juniorsTeam(), "Kid");
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        MatchSide juniorsSide = sideWith(juniorsMatch, w.juniorsTeam(), kid);
        MatchSide seniorsSide = sideWith(seniorsMatch, w.seniors1(), ann);
        JwtRequestPostProcessor seniorsManager = sectionManager(w, w.seniors());

        mockMvc.perform(post(REMOVE, w.club().getId(), juniorsMatch.getId(), juniorsSide.getId(), kid.getId())
                        .param("keepAnnounced", "true").with(seniorsManager))
                .andExpect(status().isForbidden());
        assertThat(rows(juniorsSide)).hasSize(1);
        mockMvc.perform(post(REMOVE, w.club().getId(), seniorsMatch.getId(), seniorsSide.getId(), ann.getId())
                        .param("keepAnnounced", "true").with(seniorsManager))
                .andExpect(status().isOk());
        assertThat(rows(seniorsSide)).isEmpty();
    }

    // --- release: remove with and without keepAnnounced ---

    @Test
    void removeWithKeepAnnouncedLeavesTheSideAnnouncedAndWithoutItUnannouncesIt() throws Exception {
        World w = world();
        Match match = match(w, w.seniors1(), null, at(0, 9));
        PlayerProfile ann = rosterPlayer(w, w.seniors1(), "Ann");
        PlayerProfile bob = rosterPlayer(w, w.seniors1(), "Bob");
        MatchSide side = sideWith(match, w.seniors1(), ann, bob);
        side.setAnnounced(true);
        matchSideRepository.save(side);
        JwtRequestPostProcessor admin = clubAdmin(w);

        mockMvc.perform(post(REMOVE, w.club().getId(), match.getId(), side.getId(), ann.getId())
                        .param("keepAnnounced", "true").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.announced").value(true))
                .andExpect(jsonPath("$.players", hasSize(1)))
                .andExpect(jsonPath("$.players[0].battingOrder").value(1));
        assertThat(matchSideRepository.findById(side.getId()).orElseThrow().isAnnounced()).isTrue();

        mockMvc.perform(post(REMOVE, w.club().getId(), match.getId(), side.getId(), bob.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.announced").value(false));
        assertThat(matchSideRepository.findById(side.getId()).orElseThrow().isAnnounced()).isFalse();
    }

    @Test
    void releasingAPlayerFromTheOtherTeamLetsTheSecondTeamSelectHimAtOnce() throws Exception {
        World w = world();
        Match mine = match(w, w.seniors1(), null, at(0, 9));
        Match theirs = match(w, w.seniors2(), null, at(0, 9));
        MatchSide mySide = side(mine, w.seniors1());
        MatchSide theirSide = sideWith(theirs, w.seniors2(), rosterPlayer(w, w.seniors2(), "Filler"));
        PlayerProfile jaden = rosterPlayer(w, w.seniors1(), "Jaden");
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(theirSide.getId())
                .playerProfileId(jaden.getId()).battingOrder(2).role(PlayingRole.BATSMAN).build());
        JwtRequestPostProcessor admin = clubAdmin(w);

        apply(admin, w, mine, mySide, applyBody(entry(jaden))).andExpect(status().isConflict());
        mockMvc.perform(post(REMOVE, w.club().getId(), theirs.getId(), theirSide.getId(), jaden.getId())
                        .param("keepAnnounced", "true").with(admin))
                .andExpect(status().isOk());
        apply(admin, w, mine, mySide, applyBody(entry(jaden))).andExpect(status().isOk());
    }
}
