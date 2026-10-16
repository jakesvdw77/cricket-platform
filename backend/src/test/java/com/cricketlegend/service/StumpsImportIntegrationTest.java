package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportExactness;
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
import com.cricketlegend.support.StumpsPdfFixtures;
import java.time.LocalDate;
import java.time.LocalTime;
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
 * docs/specs/108-match-results-stumps-pdf-adaptor.md, Test Plan "Integration": masked PDFs (see {@code StumpsPdfFixtures})
 * through {@code ResultImportService.preview} and {@code resolve} onto a match whose team names mirror the report's, then
 * read back as the saved draft: the toss, the match id as the external id, the result and its margin, the innings, the
 * batting and bowling rows and the names matched to the squad, a re-import of the same match id needing the replace
 * acknowledgement, a refused file writing nothing, and nothing ever published. Not {@code @Transactional}, like
 * CricClubsImportIntegrationTest, so every write is a real commit and the fixtures remove what they seeded. Placeholder
 * names only.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class StumpsImportIntegrationTest {

    private static final String SOURCE = "IMPORT:STUMPS";
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

    private record Scenario(Match match, Map<String, PlayerProfile> squad) {}

    /** A match of the club's first Seniors team, renamed to {@code ours}, against {@code theirs}, with a named squad. */
    private Scenario scenario(String ours, String theirs, String... squadNames) {
        jdbc.update("update team set name = ? where id = ?", ours, club.world().seniors1().getId());
        Match match = fixtures.match(club);
        jdbc.update("update match set away_team_name = ? where id = ?", theirs, match.getId());
        Map<String, PlayerProfile> squad = new LinkedHashMap<>();
        for (String full : squadNames) {
            String[] parts = full.split(" ", 2);
            Person person = personRepository.save(Person.builder().firstName(parts[0]).lastName(parts[1])
                    .dateOfBirth(LocalDate.of(2012, 1, 1)).build());
            personIds.add(person.getId());
            PlayerProfile profile = profileRepository.save(
                    PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
            squadRepository.save(TeamSquadMember.builder().teamId(club.world().seniors1().getId())
                    .seasonId(club.world().season().getId()).playerProfileId(profile.getId()).build());
            squad.put(full, profile);
        }
        return new Scenario(match, squad);
    }

    private ImportPreviewDto preview(Match match, byte[] bytes) {
        return importService.preview(admin, clubId,
                new ImportPreviewRequest(AdaptorType.STUMPS_PDF, ImportInputFormat.PDF, null, match.getId()),
                "report.pdf", bytes);
    }

    /** Preview then resolve, as the wizard does; the club's team ({@code Team A U15}) is the home side. */
    private ImportResolveDto importPdf(Match match, byte[] bytes, boolean replace) {
        ImportPreviewDto preview = preview(match, bytes);
        List<TeamMappingDto> mapping = preview.document().teams().stream()
                .map(t -> new TeamMappingDto(t.key(), t.name(), t.name().equals(StumpsPdfFixtures.TEAM_A) ? HOME : AWAY,
                        ImportExactness.EXACT, null))
                .toList();
        // the names mirror the match, so the preview already proposes the same sides
        assertThat(preview.teamMapping()).extracting(TeamMappingDto::fileName, TeamMappingDto::side)
                .containsExactlyElementsOf(mapping.stream()
                        .map(m -> org.assertj.core.groups.Tuple.tuple(m.fileName(), m.side())).toList());
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

    private static List<BattingEntryDto> batting(ScorecardDto card, ResultSide side) {
        return card.batting().stream().filter(b -> b.battingSide() == side).toList();
    }

    private static List<BowlingEntryDto> bowling(ScorecardDto card, ResultSide side) {
        return card.bowling().stream().filter(b -> b.battingSide() == side).toList();
    }

    private static BattingEntryDto bat(ScorecardDto card, ResultSide side, String displayName) {
        UUID id = player(card, displayName).id();
        return batting(card, side).stream().filter(b -> id.equals(b.resultPlayerId())).findFirst().orElseThrow();
    }

    private static String nameOf(ScorecardDto card, String playerId) {
        return playerId == null ? null : card.players().stream().filter(p -> playerId.equals(p.id().toString()))
                .findFirst().orElseThrow().displayName();
    }

    private static InningsDto innings(MatchResultDto result, int sequence) {
        return result.innings().stream().filter(i -> i.sequence() == sequence).findFirst().orElseThrow();
    }

    /** What every STUMPS import must leave behind: one unpublished draft from the adaptor carrying the report's match id. */
    private void assertDraftFromReport(Match match, ImportResolveDto resolved) {
        MatchResult stored = stored(match);
        assertThat(resolved.resultStatus()).isEqualTo(ResultStatus.DRAFT);
        assertThat(stored.getStatus()).isEqualTo(ResultStatus.DRAFT);
        assertThat(stored.getSource()).isEqualTo(SOURCE);
        assertThat(stored.getExternalId()).isEqualTo(StumpsPdfFixtures.MATCH_ID);
        assertThat(stored.getPublishedAt()).isNull();
        assertThat(count("select count(*) from match_result where match_id = ? and status = 'PUBLISHED'", match.getId()))
                .isZero();
    }

    // ---- the report ----

    @Test
    void aReportImportsAsADraftWithTheTossTheMatchIdTheResultAndEveryRow() {
        Scenario s = scenario("Team A U15", "Team B U15", "Player 7", "Player 1", "Player 20");

        ImportPreviewDto preview = preview(s.match, StumpsPdfFixtures.pdf());
        assertThat(preview.document().match().date()).isEqualTo(LocalDate.of(2026, 11, 21));
        assertThat(preview.document().match().startTime()).isEqualTo(LocalTime.of(13, 30));
        assertThat(preview.document().match().venue()).isEqualTo("Placeholder Ground");
        assertThat(preview.document().source().provider()).isEqualTo("STUMPS");
        assertThat(preview.document().source().adaptor()).isEqualTo(AdaptorType.STUMPS_PDF);
        assertThat(preview.document().source().fileName()).isEqualTo("report.pdf");
        assertThat(preview.existingForExternalId()).as("a first import finds no draft").isNull();

        ImportResolveDto resolved = importPdf(s.match, StumpsPdfFixtures.pdf(), false);

        assertDraftFromReport(s.match, resolved);
        MatchResultDto result = result(s.match);
        assertThat(result.outcomeType()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.winningSide()).isEqualTo(AWAY);
        assertThat(result.marginType()).isEqualTo(ResultMarginType.WICKETS);
        assertThat(result.marginValue()).isEqualTo(6);
        assertThat(result.scheduledBalls()).isEqualTo(120);
        assertThat(result.tossWonBy()).isEqualTo(HOME);
        assertThat(result.tossDecision()).isEqualTo(TossDecision.BAT);
        assertThat(result.innings()).hasSize(2);
        InningsDto first = innings(result, 1);
        assertThat(first.battingSide()).isEqualTo(HOME);
        assertThat(first.runs()).isEqualTo(105);
        assertThat(first.wickets()).isEqualTo(6);
        assertThat(first.balls()).isEqualTo(120);
        assertThat(first.wides()).isEqualTo(6);
        assertThat(first.noBalls()).isEqualTo(1);
        assertThat(first.byes()).isEqualTo(2);
        assertThat(first.legByes()).isEqualTo(1);
        InningsDto second = innings(result, 2);
        assertThat(second.battingSide()).isEqualTo(AWAY);
        assertThat(second.runs()).isEqualTo(111);
        assertThat(second.wickets()).isEqualTo(4);
        assertThat(second.balls()).isEqualTo(105);

        ScorecardDto card = card(s.match);
        assertThat(batting(card, HOME)).hasSize(8);
        assertThat(batting(card, AWAY)).hasSize(6);
        assertThat(bowling(card, HOME)).hasSize(5);
        assertThat(bowling(card, AWAY)).hasSize(5);
        assertThat(card.awards()).as("the report names no player of the match").isEmpty();

        // every dismissal form
        assertThat(bat(card, HOME, "Player 1").howOut()).isEqualTo(DismissalType.BOWLED);
        BattingEntryDto caught = bat(card, HOME, "Player 2");
        assertThat(caught.howOut()).isEqualTo(DismissalType.CAUGHT);
        assertThat(nameOf(card, caught.fielderPlayerId())).isEqualTo("Player 15");
        assertThat(nameOf(card, caught.bowlerPlayerId())).isEqualTo("Player 14");
        BattingEntryDto caughtAndBowled = bat(card, HOME, "Player 3");
        assertThat(caughtAndBowled.howOut()).isEqualTo(DismissalType.CAUGHT_AND_BOWLED);
        assertThat(caughtAndBowled.fielderPlayerId()).isNull();
        assertThat(bat(card, HOME, "Player 4").howOut()).isEqualTo(DismissalType.LBW);
        BattingEntryDto runOut = bat(card, HOME, "Player 5");
        assertThat(runOut.howOut()).isEqualTo(DismissalType.RUN_OUT);
        assertThat(nameOf(card, runOut.fielderPlayerId())).isEqualTo("Player 17");
        assertThat(runOut.bowlerPlayerId()).isNull();
        assertThat(bat(card, HOME, "Player 7").howOut()).isEqualTo(DismissalType.NOT_OUT);

        // the squad's players are linked to their profiles, the report's other names stay guests
        assertThat(player(card, "Player 7").playerProfileId()).isEqualTo(s.squad.get("Player 7").getId());
        assertThat(player(card, "Player 1").playerProfileId()).isEqualTo(s.squad.get("Player 1").getId());
        assertThat(player(card, "Player 14").playerProfileId()).isNull();
        assertThat(player(card, "Player 14").opposition()).isTrue();
    }

    @Test
    void aDlsReportWithAPlayerOfTheMatchKeepsTheDecidedByAndRecordsTheAward() {
        Scenario s = scenario("Team A U15", "Team B U15", "Player 7");
        String report = StumpsPdfFixtures.text()
                .replace("Team B U15 won by 6 wickets", "Team A U15 won by 15 runs (D/L\nMethod)")
                .replace("Player Of The Match\n-", "Player Of The Match\nPlayer 7");

        ImportResolveDto resolved = importPdf(s.match, StumpsPdfFixtures.pdf(report), false);

        assertDraftFromReport(s.match, resolved);
        MatchResultDto result = result(s.match);
        assertThat(result.decidedBy()).isEqualTo(ResultDecidedBy.DLS);
        assertThat(result.winningSide()).isEqualTo(HOME);
        assertThat(result.marginType()).isEqualTo(ResultMarginType.RUNS);
        assertThat(result.marginValue()).isEqualTo(15);
        assertThat(result.dlsTarget()).as("no target is invented").isNull();
        ScorecardDto card = card(s.match);
        assertThat(card.awards()).hasSize(1);
        assertThat(card.awards().get(0).awardType()).isEqualTo(AwardType.PLAYER_OF_MATCH);
        assertThat(card.awards().get(0).resultPlayerId()).isEqualTo(player(card, "Player 7").id());
    }

    // ---- re-import ----

    @Test
    void importingTheSameMatchIdAgainFindsTheDraftAndNeedsTheAcknowledgement() {
        Scenario s = scenario("Team A U15", "Team B U15", "Player 7");
        importPdf(s.match, StumpsPdfFixtures.pdf(), false);
        UUID resultId = stored(s.match).getId();
        Map<String, Long> before = snapshot();

        ImportPreviewDto again = preview(s.match, StumpsPdfFixtures.pdf());
        assertThat(again.existingForExternalId()).as("the draft this match id made").isNotNull();
        assertThatThrownBy(() -> importPdf(s.match, StumpsPdfFixtures.pdf(), false))
                .isInstanceOf(ImportWouldOverwriteDraftException.class);
        assertThat(snapshot()).isEqualTo(before);

        ImportResolveDto replaced = importPdf(s.match, StumpsPdfFixtures.pdf(), true);

        assertDraftFromReport(s.match, replaced);
        assertThat(stored(s.match).getId()).isEqualTo(resultId);
        assertThat(snapshot()).isEqualTo(before);
        assertThat(count("select count(*) from match_result where match_id = ?", s.match.getId())).isEqualTo(1);
        assertThat(card(s.match).batting()).hasSize(14);
    }

    // ---- files that are refused ----

    @Test
    void aPdfThatIsNotAStumpsReportIsRefusedAndNothingIsWritten() {
        Scenario s = scenario("Team A U15", "Team B U15");
        Map<String, Long> before = snapshot();

        assertThatThrownBy(() -> preview(s.match, StumpsPdfFixtures.pdf("Some other document\nwith a few lines")))
                .isInstanceOfSatisfying(ImportInputValidationException.class, e -> {
                    assertThat(e.getErrors()).extracting(ImportErrorDto::code).containsExactly("NOT_A_STUMPS_REPORT");
                });

        assertThat(snapshot()).isEqualTo(before);
        assertThat(resultRepository.findByMatchId(s.match.getId())).isEmpty();
    }

    @Test
    void aReportWithAnUnknownDismissalIsRefusedWithItsPageAndLineAndNothingIsWritten() {
        Scenario s = scenario("Team A U15", "Team B U15");
        Map<String, Long> before = snapshot();
        byte[] report = StumpsPdfFixtures.pdf(StumpsPdfFixtures.text().replace("lbw Player 14", "st Player 3 b Player 16"));

        assertThatThrownBy(() -> preview(s.match, report))
                .isInstanceOfSatisfying(ImportInputValidationException.class, e -> {
                    assertThat(e.getErrors()).hasSize(1);
                    assertThat(e.getErrors().get(0).code()).isEqualTo("UNKNOWN_DISMISSAL");
                    assertThat(e.getErrors().get(0).path()).matches("page \\d+, line \\d+");
                });

        assertThat(snapshot()).isEqualTo(before);
    }

    // ---- the catalogue ----

    @Test
    void theCatalogueListsTheAdaptorAsAPdfUploadOnly() {
        var descriptor = importService.listAdaptors().adaptors().stream()
                .filter(a -> a.type() == AdaptorType.STUMPS_PDF).findFirst().orElseThrow();

        assertThat(descriptor.displayName()).isEqualTo("STUMPS match report (PDF)");
        assertThat(descriptor.aiAllowed()).isFalse();
        assertThat(descriptor.example()).isNull();
        assertThat(descriptor.conversionPrompt()).isNull();
        assertThat(descriptor.inputs()).extracting(i -> i.format()).containsExactly(ImportInputFormat.PDF);
        assertThat(descriptor.inputs()).allSatisfy(i -> assertThat(i.acceptsPaste()).isFalse());
    }
}
