package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportPreviewDto;
import com.cricketlegend.dto.ImportPreviewRequest;
import com.cricketlegend.dto.ImportResolveDto;
import com.cricketlegend.dto.ImportResolveRequest;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.dto.TeamMappingDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.ImportWouldOverwriteDraftException;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.adaptor.AdaptorType;
import com.cricketlegend.service.adaptor.ImportInputFormat;
import com.cricketlegend.support.ResultImportFixtures;
import com.cricketlegend.support.ResultImportFixtures.Club;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md, Test Plan "Integration": each CricClubs fixture file, uploaded
 * as bytes, through {@code ResultImportService.preview} and {@code resolve} onto a match whose team names mirror the
 * file's, then read back as the saved draft. Not {@code @Transactional}, like ResultImportServiceIntegrationTest, so
 * every write is a real commit and the fixtures remove what they seeded. Invented names only.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class CricClubsImportIntegrationTest {

    private static final String SOURCE = "IMPORT:CRICCLUBS";
    private static final ResultSide HOME = ResultSide.HOME;
    private static final ResultSide AWAY = ResultSide.AWAY;

    @Autowired
    private ResultImportService importService;

    @Autowired
    private ResultService resultService;

    @Autowired
    private ScorecardService scorecardService;

    @Autowired
    private MatchResultRepository resultRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository profileRepository;

    @Autowired
    private TeamSquadMemberRepository squadRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationContext context;

    private ResultImportFixtures fixtures;
    private Club club;
    private UUID clubId;
    private final List<UUID> personIds = new ArrayList<>();
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        fixtures = new ResultImportFixtures(context);
        club = fixtures.club();
        clubId = club.world().club().getId();
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
        if (!personIds.isEmpty()) {
            jdbc.update("delete from person where id = any (?)", (Object) personIds.toArray(new UUID[0]));
        }
    }

    // ---- scenario helpers ----

    /** A match of the club's first Seniors team, renamed to {@code ours}, against {@code theirs}, with a named squad. */
    private record Scenario(Match match, Map<String, PlayerProfile> squad) {}

    private Scenario scenario(String ours, String theirs, String... squadNames) {
        jdbc.update("update team set name = ? where id = ?", ours, club.world().seniors1().getId());
        Match match = fixtures.match(club);
        jdbc.update("update match set away_team_name = ? where id = ?", theirs, match.getId());
        Map<String, PlayerProfile> squad = new LinkedHashMap<>();
        for (String full : squadNames) {
            String[] parts = full.split(" ", 2);
            Person person = personRepository.save(Person.builder().firstName(parts[0]).lastName(parts[1])
                    .dateOfBirth(LocalDate.of(1990, 1, 1)).build());
            personIds.add(person.getId());
            PlayerProfile profile = profileRepository.save(
                    PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
            squadRepository.save(TeamSquadMember.builder().teamId(club.world().seniors1().getId())
                    .seasonId(club.world().season().getId()).playerProfileId(profile.getId()).build());
            fixtures.shared().makeEligible(club.world().seniors1(), profile); // docs/specs/113
            squad.put(full, profile);
        }
        return new Scenario(match, squad);
    }

    private static byte[] file(String name) {
        try (InputStream in = CricClubsImportIntegrationTest.class.getResourceAsStream("/imports/results/cricclubs/" + name)) {
            assertThat(in).as("fixture " + name).isNotNull();
            return in.readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private ImportPreviewDto preview(Match match, String name, byte[] bytes) {
        return importService.preview(admin, clubId,
                new ImportPreviewRequest(AdaptorType.CRICCLUBS_CSV, ImportInputFormat.CSV, null, match.getId()),
                name, bytes);
    }

    /** Preview then resolve, as the wizard does; the club's team (file name {@code ours}) is the home side. */
    private ImportResolveDto importFile(Match match, String name, String ours, boolean replace) {
        ImportPreviewDto preview = preview(match, name, file(name));
        List<TeamMappingDto> mapping = preview.document().teams().stream()
                .map(t -> new TeamMappingDto(t.key(), t.name(), t.name().equals(ours) ? HOME : AWAY,
                        com.cricketlegend.dto.ImportExactness.EXACT, null))
                .toList();
        // the names mirror the match, so the preview already proposes the same sides
        assertThat(preview.teamMapping()).extracting(TeamMappingDto::fileName, TeamMappingDto::side)
                .containsExactlyElementsOf(mapping.stream().map(m -> org.assertj.core.groups.Tuple.tuple(m.fileName(), m.side())).toList());
        return importService.resolve(admin, clubId,
                new ImportResolveRequest(preview.document(), match.getId(), mapping, replace));
    }

    private MatchResult stored(Match match) {
        return resultRepository.findByMatchId(match.getId()).orElseThrow();
    }

    private MatchResultDto result(Match match) {
        return resultService.get(admin, clubId, match.getId());
    }

    private ScorecardDto card(Match match) {
        return scorecardService.read(admin, clubId, match.getId());
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private Map<String, Long> snapshot() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : List.of("match", "match_result", "match_innings", "result_player", "batting_entry",
                "bowling_entry", "person", "player_profile", "result_name_alias")) {
            counts.put(table, count("select count(*) from " + table));
        }
        return counts;
    }

    private static ResultPlayerDto player(ScorecardDto card, String displayName) {
        return card.players().stream().filter(p -> displayName.equals(p.displayName())).findFirst()
                .orElseThrow(() -> new AssertionError("no player " + displayName + " in " + card.players().stream()
                        .map(ResultPlayerDto::displayName).toList()));
    }

    private static ResultPlayerDto player(ScorecardDto card, PlayerProfile profile) {
        return card.players().stream().filter(p -> profile.getId().equals(p.playerProfileId())).findFirst()
                .orElseThrow(() -> new AssertionError("profile not on the scorecard"));
    }

    private static String nameOf(ScorecardDto card, String playerId) {
        return playerId == null ? null : card.players().stream().filter(p -> playerId.equals(p.id().toString()))
                .findFirst().orElseThrow().displayName();
    }

    private static List<BattingEntryDto> batting(ScorecardDto card, ResultSide side) {
        return card.batting().stream().filter(b -> b.battingSide() == side).toList();
    }

    private static List<BowlingEntryDto> bowling(ScorecardDto card, ResultSide side) {
        return card.bowling().stream().filter(b -> b.battingSide() == side).toList();
    }

    /** The batting entry of the player with this display name. */
    private static BattingEntryDto bat(ScorecardDto card, ResultSide side, String displayName) {
        UUID id = player(card, displayName).id();
        return batting(card, side).stream().filter(b -> id.equals(b.resultPlayerId())).findFirst().orElseThrow();
    }

    private static BowlingEntryDto bowl(ScorecardDto card, ResultSide side, String displayName) {
        UUID id = player(card, displayName).id();
        return bowling(card, side).stream().filter(b -> id.equals(b.resultPlayerId())).findFirst().orElseThrow();
    }

    private static InningsDto innings(MatchResultDto result, int sequence) {
        return result.innings().stream().filter(i -> i.sequence() == sequence).findFirst().orElseThrow();
    }

    /** What every import of this adaptor must leave behind: one unpublished draft from the adaptor with no provider id. */
    private void assertDraftFromAdaptor(Match match, ImportResolveDto resolved) {
        MatchResult stored = stored(match);
        assertThat(resolved.resultStatus()).isEqualTo(ResultStatus.DRAFT);
        assertThat(stored.getStatus()).isEqualTo(ResultStatus.DRAFT);
        assertThat(stored.getSource()).isEqualTo(SOURCE);
        assertThat(stored.getExternalId()).isNull();
        assertThat(stored.getPublishedAt()).isNull();
        assertThat(count("select count(*) from match_result where match_id = ? and status = 'PUBLISHED'", match.getId()))
                .isZero();
    }

    // ---- the fixtures ----

    @Test
    void aChaseImportsAsADraftWithTheWinnerOnWicketsAndEveryDismissal() {
        Scenario s = scenario("Harbour Town 1", "Riverbend 2", "Ben Placeholder", "Gil Sample");

        ImportResolveDto resolved = importFile(s.match, "chase.csv", "Harbour Town 1", false);

        assertDraftFromAdaptor(s.match, resolved);
        MatchResultDto result = result(s.match);
        assertThat(result.outcomeType()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.winningSide()).isEqualTo(AWAY);
        assertThat(result.marginType()).isEqualTo(ResultMarginType.WICKETS);
        assertThat(result.marginValue()).isEqualTo(8);
        assertThat(result.scheduledBalls()).isEqualTo(120);
        assertThat(result.innings()).hasSize(2);
        InningsDto first = innings(result, 1);
        assertThat(first.battingSide()).isEqualTo(HOME);
        assertThat(first.runs()).isEqualTo(78);
        assertThat(first.wickets()).isEqualTo(7);
        assertThat(first.balls()).isEqualTo(114);
        assertThat(first.wides()).isEqualTo(12);
        assertThat(first.noBalls()).isEqualTo(1);
        assertThat(first.byes()).isEqualTo(1);
        assertThat(first.legByes()).isEqualTo(3);
        InningsDto second = innings(result, 2);
        assertThat(second.battingSide()).isEqualTo(AWAY);
        assertThat(second.runs()).isEqualTo(80);
        assertThat(second.wickets()).isEqualTo(2);
        assertThat(second.balls()).isEqualTo(63);

        ScorecardDto card = card(s.match);
        assertThat(batting(card, HOME)).hasSize(11);
        assertThat(batting(card, AWAY)).hasSize(11);
        assertThat(bowling(card, HOME)).hasSize(4);
        assertThat(bowling(card, AWAY)).hasSize(4);

        // lbw, caught with a fielder, caught behind the stumps, bowled, run out, stumped, caught and bowled
        assertThat(bat(card, HOME, "Anna Example").howOut()).isEqualTo(DismissalType.LBW);
        BattingEntryDto ben = bat(card, HOME, "Ben Placeholder");
        assertThat(ben.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(nameOf(card, ben.fielderPlayerId())).isEqualTo("Dee Spare");
        assertThat(nameOf(card, ben.bowlerPlayerId())).isEqualTo("Eve Tester");
        assertThat(bat(card, HOME, "Cal Invented").howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(bat(card, HOME, "Dan Madeup").howOut()).isEqualTo(DismissalType.BOWLED);
        BattingEntryDto runOut = bat(card, HOME, "Eli Fiction");
        assertThat(runOut.howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(nameOf(card, runOut.fielderPlayerId())).isEqualTo("Ian Field");
        assertThat(runOut.bowlerPlayerId()).as("a run out credits no bowler").isNull();
        BattingEntryDto stumped = bat(card, HOME, "Fin Notreal");
        assertThat(stumped.howOut()).isEqualTo(DismissalType.STUMPED);
        assertThat(nameOf(card, stumped.fielderPlayerId())).isEqualTo("Fay Keeper");
        BattingEntryDto caughtAndBowled = bat(card, HOME, "Gil Sample");
        assertThat(caughtAndBowled.howOut()).isEqualTo(DismissalType.CAUGHT_AND_BOWLED);
        assertThat(caughtAndBowled.fielderPlayerId()).isNull();
        assertThat(nameOf(card, caughtAndBowled.bowlerPlayerId())).isEqualTo("Hal Quick");
        assertThat(bat(card, HOME, "Hugh Pretend").howOut()).isEqualTo(DismissalType.NOT_OUT);
        assertThat(bat(card, HOME, "Ivy Dummy").howOut()).isEqualTo(DismissalType.DID_NOT_BAT);

        // the players of the squad are linked to their profiles, the file's other names stay guests
        assertThat(player(card, s.squad.get("Ben Placeholder")).displayName()).isEqualTo("Ben Placeholder");
        assertThat(player(card, s.squad.get("Gil Sample")).displayName()).isEqualTo("Gil Sample");
        assertThat(player(card, "Anna Example").playerProfileId()).isNull();
        assertThat(player(card, "Hal Quick").opposition()).isTrue();
        assertThat(bowl(card, HOME, "Hal Quick").wickets()).isEqualTo(2);
    }

    @Test
    void aWinByRunsKeepsTheMarginTheRetiredNotOutBattersAndASubstituteCatchWithNoFielder() {
        Scenario s = scenario("Hillside 4", "Valley Rovers", "Pat Alpha", "Tom Gamma", "Abe Lambda", "Bo Mu", "Cy Nu");

        ImportResolveDto resolved = importFile(s.match, "win-by-runs.csv", "Hillside 4", false);

        assertDraftFromAdaptor(s.match, resolved);
        MatchResultDto result = result(s.match);
        assertThat(result.outcomeType()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.winningSide()).isEqualTo(HOME);
        assertThat(result.marginType()).isEqualTo(ResultMarginType.RUNS);
        assertThat(result.marginValue()).isEqualTo(135);
        InningsDto first = innings(result, 1);
        assertThat(first.runs()).isEqualTo(192);
        assertThat(first.wickets()).isEqualTo(3);
        assertThat(first.balls()).isEqualTo(120);
        assertThat(first.wides()).isEqualTo(15);
        assertThat(first.noBalls()).isEqualTo(1);
        InningsDto second = innings(result, 2);
        assertThat(second.battingSide()).isEqualTo(AWAY);
        assertThat(second.runs()).isEqualTo(57);
        assertThat(second.wickets()).isEqualTo(10);
        assertThat(second.balls()).isEqualTo(66);
        assertThat(second.allOut()).isTrue();

        ScorecardDto card = card(s.match);
        assertThat(batting(card, HOME)).hasSize(12);
        assertThat(batting(card, AWAY)).hasSize(11);
        assertThat(bowling(card, HOME)).hasSize(5);
        assertThat(bowling(card, AWAY)).hasSize(4);

        // retired not out: a batter who is not out, so the three wickets are the three dismissals
        assertThat(bat(card, HOME, "Pat Alpha").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(bat(card, HOME, "Pat Alpha").runs()).isEqualTo(101);
        assertThat(bat(card, HOME, "Tom Gamma").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        // a substitute took the catch: the dismissal and its bowler stay, there is no fielder
        BattingEntryDto substitute = bat(card, AWAY, "Val Zeta");
        assertThat(substitute.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(substitute.fielderPlayerId()).isNull();
        assertThat(nameOf(card, substitute.bowlerPlayerId())).isEqualTo("Bo Mu");
        assertThat(player(card, s.squad.get("Bo Mu")).playerProfileId()).isEqualTo(s.squad.get("Bo Mu").getId());
        assertThat(player(card, "Val Zeta").opposition()).isTrue();
        // caught and bowled, and a run out whose stray bowler is dropped
        BattingEntryDto caughtAndBowled = bat(card, AWAY, "Ian Tau");
        assertThat(caughtAndBowled.howOut()).isEqualTo(DismissalType.CAUGHT_AND_BOWLED);
        assertThat(caughtAndBowled.fielderPlayerId()).isNull();
        assertThat(nameOf(card, caughtAndBowled.bowlerPlayerId())).isEqualTo("Abe Lambda");
        BattingEntryDto runOut = bat(card, AWAY, "Hal Sigma");
        assertThat(runOut.howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(nameOf(card, runOut.fielderPlayerId())).isEqualTo("Pat Alpha");
        assertThat(runOut.bowlerPlayerId()).isNull();
        assertThat(bat(card, AWAY, "Kim Phi").howOut()).isEqualTo(DismissalType.NOT_OUT);
    }

    @Test
    void aTieHasNoWinnerAndNoMarginAndResolvesAbbreviatedNamesAgainstTheSquad() {
        Scenario s = scenario("Meadow 2 XI Stars", "Harbour Town 1", "Ash Aster", "Bea Briar", "Eli Elder", "Gus Gorse",
                "Hui Heath", "Jo Jade", "Kai Kale");

        ImportResolveDto resolved = importFile(s.match, "tie.csv", "Meadow 2 XI Stars", false);

        assertDraftFromAdaptor(s.match, resolved);
        MatchResultDto result = result(s.match);
        assertThat(result.outcomeType()).isEqualTo(ResultOutcomeType.TIE);
        assertThat(result.winningSide()).isNull();
        assertThat(result.marginType()).isNull();
        assertThat(result.marginValue()).isNull();
        assertThat(innings(result, 1).battingSide()).isEqualTo(HOME);
        assertThat(innings(result, 1).runs()).isEqualTo(129);
        assertThat(innings(result, 1).wickets()).isEqualTo(9);
        assertThat(innings(result, 1).balls()).isEqualTo(120);
        assertThat(innings(result, 2).runs()).isEqualTo(129);
        assertThat(innings(result, 2).wickets()).isEqualTo(7);
        assertThat(innings(result, 2).balls()).isEqualTo(120);

        ScorecardDto card = card(s.match);
        assertThat(batting(card, HOME)).hasSize(11);
        assertThat(batting(card, AWAY)).hasSize(12);
        assertThat(bowling(card, HOME)).hasSize(7);
        assertThat(bowling(card, AWAY)).hasSize(6);

        // the abbreviations on the other side's page ("Bea B", "Ash A", ...) are our squad's players
        ResultPlayerDto bea = player(card, s.squad.get("Bea Briar"));
        ResultPlayerDto ash = player(card, s.squad.get("Ash Aster"));
        ResultPlayerDto hui = player(card, s.squad.get("Hui Heath"));
        ResultPlayerDto eli = player(card, s.squad.get("Eli Elder"));
        BattingEntryDto tia = bat(card, AWAY, "Tia Thyme");
        assertThat(tia.bowlerPlayerId()).isEqualTo(bea.id().toString());
        BattingEntryDto ria = bat(card, AWAY, "Ria Rose");
        assertThat(ria.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(ria.fielderPlayerId()).isEqualTo(ash.id().toString());
        assertThat(ria.bowlerPlayerId()).isEqualTo(hui.id().toString());
        assertThat(bat(card, AWAY, "Una Urn").bowlerPlayerId()).isEqualTo(eli.id().toString());
        BattingEntryDto mo = bat(card, AWAY, "Mo Moss");
        assertThat(mo.fielderPlayerId()).isEqualTo(player(card, s.squad.get("Gus Gorse")).id().toString());
        assertThat(mo.bowlerPlayerId()).isEqualTo(player(card, s.squad.get("Kai Kale")).id().toString());
        // each is also written in full on their own side's page, so the row is an exact match, not a guess
        assertThat(ash.importMatch()).isNull();
        assertThat(ash.displayName()).isEqualTo("Ash Aster");
        // and the same player is one row whether written in full or abbreviated
        assertThat(card.players().stream().filter(p -> s.squad.get("Bea Briar").getId().equals(p.playerProfileId())))
                .hasSize(1);
        assertThat(bowl(card, AWAY, "Bea Briar").wickets()).isEqualTo(1);
    }

    @Test
    void aForfeitSavesAnOutcomeWithNoInningsAndNoScorecard() {
        Scenario s = scenario("Harbour Town 1", "Meadow 4");

        ImportResolveDto resolved = importFile(s.match, "forfeit.csv", "Harbour Town 1", false);

        assertDraftFromAdaptor(s.match, resolved);
        MatchResultDto result = result(s.match);
        assertThat(result.outcomeType()).isEqualTo(ResultOutcomeType.FORFEIT);
        assertThat(result.winningSide()).isEqualTo(HOME);
        assertThat(result.innings()).isEmpty();
        assertThat(result.hasScorecard()).isFalse();
        ScorecardDto card = card(s.match);
        assertThat(card.players()).isEmpty();
        assertThat(card.batting()).isEmpty();
        assertThat(card.bowling()).isEmpty();
    }

    @Test
    void aWindows1252PracticeMatchKeepsItsAccentedNameAndReadsFiftyOvers() {
        Scenario s = scenario("Wicketkeepers", "Stumps Cricket Club", "Ann Alder", "Bob Birch", "Emma Elm", "Gwen Gum",
                "Hank Holly", "Ida Iris", "Jed Jasmine");

        ImportResolveDto resolved = importFile(s.match, "practice-50-overs-windows-1252.csv", "Wicketkeepers", false);

        assertDraftFromAdaptor(s.match, resolved);
        MatchResultDto result = result(s.match);
        assertThat(result.outcomeType()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.winningSide()).isEqualTo(HOME);
        assertThat(result.marginType()).isEqualTo(ResultMarginType.RUNS);
        assertThat(result.marginValue()).isEqualTo(84);
        assertThat(result.scheduledBalls()).isEqualTo(300);
        assertThat(innings(result, 1).runs()).isEqualTo(227);
        assertThat(innings(result, 1).wickets()).isEqualTo(5);
        assertThat(innings(result, 1).balls()).isEqualTo(270);
        assertThat(innings(result, 2).runs()).isEqualTo(143);
        assertThat(innings(result, 2).wickets()).isEqualTo(9);
        assertThat(innings(result, 2).balls()).isEqualTo(215);

        ScorecardDto card = card(s.match);
        assertThat(batting(card, HOME)).hasSize(10);
        assertThat(batting(card, AWAY)).hasSize(11);
        assertThat(bowling(card, HOME)).hasSize(7);
        assertThat(bowling(card, AWAY)).hasSize(6);
        // the accent survived the Windows-1252 decoding
        ResultPlayerDto more = player(card, "Moré Maple");
        assertThat(more.opposition()).isTrue();
        assertThat(bat(card, AWAY, "Moré Maple").howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(bat(card, HOME, "Gwen Gum").fielderPlayerId()).isEqualTo(more.id().toString());
        // two retirements with the stated wickets equal to the dismissals: both not out
        assertThat(bat(card, HOME, "Cat Cedar").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(bat(card, HOME, "Dot Dogwood").howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        // abbreviations on the other side's page resolve to the squad, "Emma E" and "EMMA ELM" being one player
        ResultPlayerDto hank = player(card, s.squad.get("Hank Holly"));
        ResultPlayerDto ida = player(card, s.squad.get("Ida Iris"));
        BattingEntryDto moreBatting = bat(card, AWAY, "Moré Maple");
        assertThat(moreBatting.bowlerPlayerId()).isEqualTo(hank.id().toString());
        assertThat(moreBatting.fielderPlayerId()).isEqualTo(ida.id().toString());
        assertThat(bat(card, AWAY, "Ian Ivy").bowlerPlayerId())
                .isEqualTo(player(card, s.squad.get("Emma Elm")).id().toString());
        assertThat(card.players().stream().filter(p -> s.squad.get("Emma Elm").getId().equals(p.playerProfileId())))
                .hasSize(1);
        assertThat(bowl(card, AWAY, "Hank Holly").wickets()).isEqualTo(3);
    }

    @Test
    void aRetirementIsNotOutWhenTheStatedWicketsEqualTheDismissals() {
        Scenario s = scenario("Hillside 4", "Valley Rovers", "Bob Birch");

        ImportResolveDto resolved = importFile(s.match, "retired-not-out.csv", "Hillside 4", false);

        assertDraftFromAdaptor(s.match, resolved);
        assertThat(innings(result(s.match), 1).wickets()).isEqualTo(1);
        BattingEntryDto bob = bat(card(s.match), HOME, "Bob Birch");
        assertThat(bob.howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(bob.runs()).isEqualTo(40);
        assertThat(bob.bowlerPlayerId()).isNull();
    }

    @Test
    void aRetirementIsOutWhenTheStatedWicketsIncludeIt() {
        Scenario s = scenario("Hillside 4", "Valley Rovers", "Bob Birch");

        ImportResolveDto resolved = importFile(s.match, "retired-out.csv", "Hillside 4", false);

        assertDraftFromAdaptor(s.match, resolved);
        assertThat(innings(result(s.match), 1).wickets()).isEqualTo(2);
        BattingEntryDto bob = bat(card(s.match), HOME, "Bob Birch");
        assertThat(bob.howOut()).isEqualTo(DismissalType.RETIRED_OUT);
        assertThat(bob.bowlerPlayerId()).isNull();
    }

    // ---- re-import ----

    @Test
    void importingAgainOntoTheDraftNeedsTheAcknowledgementAndThenReplacesItInPlace() {
        Scenario s = scenario("Harbour Town 1", "Riverbend 2", "Ben Placeholder");
        importFile(s.match, "chase.csv", "Harbour Town 1", false);
        UUID resultId = stored(s.match).getId();
        Map<String, Long> before = snapshot();

        assertThatThrownBy(() -> importFile(s.match, "chase.csv", "Harbour Town 1", false))
                .isInstanceOf(ImportWouldOverwriteDraftException.class);
        assertThat(snapshot()).isEqualTo(before);

        ImportResolveDto again = importFile(s.match, "chase.csv", "Harbour Town 1", true);

        assertDraftFromAdaptor(s.match, again);
        assertThat(stored(s.match).getId()).isEqualTo(resultId);
        assertThat(snapshot()).isEqualTo(before);
        assertThat(card(s.match).batting()).hasSize(22);
        assertThat(count("select count(*) from match_result where match_id = ?", s.match.getId())).isEqualTo(1);
    }

    // ---- a file that is not a CricClubs report ----

    @Test
    void aCsvThatIsNotACricClubsReportIsRefusedWithItsLineNumberAndNothingIsWritten() {
        Scenario s = scenario("Hillside 4", "Valley Rovers");
        Map<String, Long> before = snapshot();
        byte[] other = "name,age,club\nAnn,31,Hillside\n".getBytes(java.nio.charset.StandardCharsets.UTF_8);

        assertThatThrownBy(() -> preview(s.match, "members.csv", other))
                .isInstanceOfSatisfying(ImportInputValidationException.class, e -> {
                    assertThat(e.getErrors()).hasSize(1);
                    ImportErrorDto error = e.getErrors().get(0);
                    assertThat(error.path()).isEqualTo("line 1");
                    assertThat(error.code()).isEqualTo("RESULT_LINE_NOT_UNDERSTOOD");
                    assertThat(error.message()).contains("not a CricClubs scorecard export");
                });

        assertThat(snapshot()).isEqualTo(before);
        assertThat(resultRepository.findByMatchId(s.match.getId())).isEmpty();
    }

    // ---- the catalogue ----

    @Test
    void theCatalogueListsTheAdaptorWithItsExampleAndTheCsvFormat() {
        var descriptor = importService.listAdaptors().adaptors().stream()
                .filter(a -> a.type() == AdaptorType.CRICCLUBS_CSV).findFirst().orElseThrow();

        assertThat(descriptor.displayName()).isEqualTo("CricClubs scorecard (CSV)");
        assertThat(descriptor.aiAllowed()).isFalse();
        assertThat(descriptor.example()).contains("Vs").contains("Batting");
        assertThat(descriptor.inputs()).isNotEmpty();
    }
}
