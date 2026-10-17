package com.cricketlegend.support;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Seeds for the docs/specs/104 import integration tests on top of {@link ManagerOverviewFixtures}: a club whose first
 * Seniors team ("Villagers 1") has a squad of three registered players (all tagged to the Seniors section, spec 113), one further registered player who is in the
 * club but in no squad, and an import document written as JSON text. Invented names only. {@link #cleanUp} removes the
 * remembered name aliases (which reference the club and are not known to the shared fixtures) before the shared clean up.
 */
public final class ResultImportFixtures {

    /** A club with its squad: Anna, Bela and Cato Player are in the squad, Dara Player is only in the club. */
    public record Club(
            World world, PlayerProfile anna, PlayerProfile bela, PlayerProfile cato, PlayerProfile dara) {}

    private final ManagerOverviewFixtures shared;
    private final JdbcTemplate jdbc;
    private final PersonRepository personRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final List<java.util.UUID> clubIds = new ArrayList<>();
    private final List<java.util.UUID> personIds = new ArrayList<>();

    public ResultImportFixtures(ApplicationContext context) {
        this.shared = new ManagerOverviewFixtures(context);
        this.jdbc = context.getBean(JdbcTemplate.class);
        this.personRepository = context.getBean(PersonRepository.class);
        this.roleAssignmentRepository = context.getBean(RoleAssignmentRepository.class);
    }

    public ManagerOverviewFixtures shared() {
        return shared;
    }

    public Club club() {
        World w = shared.world();
        clubIds.add(w.club().getId());
        return new Club(
                w,
                shared.eligiblePlayer(w, w.seniors1(), "Anna"),
                shared.eligiblePlayer(w, w.seniors1(), "Bela"),
                shared.eligiblePlayer(w, w.seniors1(), "Cato"),
                shared.player(w, "Dara", true));
    }

    /** The Keycloak subject of a new person holding a club-wide CLUB_ADMIN grant on this club. */
    public String clubAdminSubject(Club club) {
        String subject = "sub-" + java.util.UUID.randomUUID();
        Person person = personRepository.save(Person.builder().firstName("Casey").lastName("Admin")
                .email(subject + "@example.com").keycloakUserId(subject).build());
        personIds.add(person.getId());
        roleAssignmentRepository.save(RoleAssignment.builder().personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN).scopeType(ScopeType.CLUB).scopeId(club.world().club().getId())
                .build());
        return subject;
    }

    /** A past match of the club's Villagers 1 against the free-text opposition "Occasionals". */
    public Match match(Club club) {
        return shared.match(club.world(), club.world().seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
    }

    /** The local date the match was played on, as a document states it. */
    public static LocalDate dayOf(Match match) {
        return match.getMatchDate().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    /**
     * A complete, publishable-but-for-warnings document. Villagers 1 (key A, ours) bat 92 for 2 in 10.0 overs (Anna
     * 40, {@code second} 30, Zed Stranger 20 not out, 2 wides), the Occasionals (key B) bowl Olly Opp 5-0-45-2 and Pat
     * Opp 5-0-47-0 and are all out for 60 in 9.2 overs; Villagers 1 win by 32 runs. {@code externalId} may be null.
     * {@code second} is how the file spells the second batter, who is Bela Player of the squad.
     */
    public static String document(Match match, String externalId, String second) {
        return """
                {
                  "schemaVersion": 1,
                  "source": { "provider": "TestProv"%s },
                  "match": { "date": "%s", "venue": "Main Oval" },
                  "teams": [ { "key": "A", "name": "Villagers 1" }, { "key": "B", "name": "Occasionals" } ],
                  "result": { "outcome": "WON", "winner": "A", "margin": { "type": "RUNS", "value": 32 }, "scheduledOvers": 10 },
                  "innings": [
                    { "battingTeam": "A", "runs": 92, "wickets": 2, "overs": "10.0",
                      "extras": { "wides": 2, "noBalls": 0, "byes": 0, "legByes": 0, "penalty": 0 },
                      "batting": [
                        { "player": "Anna Player", "position": 1, "howOut": "BOWLED", "bowler": "Olly Opp", "runs": 40, "balls": 30 },
                        { "player": "%s", "position": 2, "howOut": "CAUGHT", "bowler": "Olly Opp", "fielder": "Pat Opp", "runs": 30, "balls": 25 },
                        { "player": "Zed Stranger", "position": 3, "howOut": "NOT_OUT", "runs": 20, "balls": 15 }
                      ],
                      "bowling": [
                        { "player": "Olly Opp", "overs": "5.0", "maidens": 0, "runs": 45, "wickets": 2 },
                        { "player": "Pat Opp", "overs": "5.0", "maidens": 0, "runs": 47, "wickets": 0 }
                      ] },
                    { "battingTeam": "B", "runs": 60, "wickets": 10, "overs": "9.2" }
                  ]
                }
                """.formatted(
                externalId == null ? "" : ", \"externalMatchId\": \"" + externalId + "\"", dayOf(match), second);
    }

    /** A forfeit: Villagers 1 are awarded the match, no innings and no names. */
    public static String forfeit(Match match, String externalId) {
        return """
                {
                  "schemaVersion": 1,
                  "source": { "provider": "TestProv"%s },
                  "match": { "date": "%s" },
                  "teams": [ { "key": "A", "name": "Villagers 1" }, { "key": "B", "name": "Occasionals" } ],
                  "result": { "outcome": "FORFEIT", "winner": "A" },
                  "innings": []
                }
                """.formatted(externalId == null ? "" : ", \"externalMatchId\": \"" + externalId + "\"", dayOf(match));
    }

    public void cleanUp() {
        if (!clubIds.isEmpty()) {
            String clubs = clubIds.stream().map(id -> "'" + id + "'").collect(Collectors.joining(","));
            jdbc.update("delete from result_name_alias where club_id in (" + clubs + ")");
            clubIds.clear();
        }
        if (!personIds.isEmpty()) {
            String persons = personIds.stream().map(id -> "'" + id + "'").collect(Collectors.joining(","));
            jdbc.update("delete from role_assignment where person_id in (" + persons + ")");
            jdbc.update("delete from person where id in (" + persons + ")");
            personIds.clear();
        }
        shared.cleanUp();
    }
}
