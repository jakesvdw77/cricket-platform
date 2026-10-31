package com.cricketlegend.service.support.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportTemplateScope;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.exception.ImportFileRejectedException;
import com.cricketlegend.service.support.ImportFile;
import com.cricketlegend.service.support.ImportFileSniffer;
import com.cricketlegend.service.support.ImportScope;
import com.cricketlegend.service.support.ParsedImport;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Result;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Row;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.RowResult;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.CandidateSource;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.TeamCandidate;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.TeamProposal;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * docs/specs/097 Test Plan, "Fixture-based parser and validator tests": every file in
 * {@code src/test/resources/imports/league-schedule/} has an {@code <file>.expected.json}; this one parameterised test
 * runs them all. Every real sheet a user supplies becomes a fixture by adding the file and its expected output.
 * Expected output: the parsed rows, the issue codes per row and for the file once every name is resolved to a league
 * team of the same name (ALL mode), and the ranked proposals against the listed candidates.
 */
class ScheduleFixtureFilesTest {

    private static final Path DIR = Paths.get("src/test/resources/imports/league-schedule");
    private static final ObjectMapper JSON = new ObjectMapper();

    static Stream<Path> fixtures() throws IOException {
        try (Stream<Path> files = Files.list(DIR)) {
            return files.filter(p -> p.getFileName().toString().endsWith(".expected.json")).sorted().toList().stream();
        }
    }

    @Test
    void theFixtureDirectoryIsNotEmpty() throws IOException {
        assertThat(fixtures().count()).isGreaterThanOrEqualTo(7);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("fixtures")
    void everyFixtureParsesValidatesAndProposesAsExpected(Path expectedFile) throws IOException {
        JsonNode expected = JSON.readTree(expectedFile.toFile());
        String fileName = expectedFile.getFileName().toString().replace(".expected.json", "");
        byte[] content = Files.readAllBytes(DIR.resolve(fileName));
        ImportScope scope = new ImportScope(UUID.randomUUID(), Map.of(), ImportScopeMode.ALL, ImportTemplateScope.OURS_AND_OTHERS);

        if (!expected.path("rejected").isNull()) {
            assertThatThrownBy(() -> ScheduleFileReader.read(ImportFileSniffer.sniff(fileName, content), scope))
                    .as(fileName)
                    .isInstanceOf(ImportFileRejectedException.class)
                    .hasMessageContaining(expected.path("rejected").asText());
            return;
        }

        ImportFile file = ImportFileSniffer.sniff(fileName, content);
        ParsedImport parsed = ScheduleFileReader.read(file, scope);
        assertParsedRows(fileName, expected.path("rows"), parsed.rows());
        assertDatesAndTimes(fileName, expected, parsed.rows());
        if (!expected.path("rowCodes").isNull()) {
            assertCodes(fileName, expected, parsed.rows());
        }
        assertProposals(fileName, expected, parsed.rows());
    }

    private static void assertParsedRows(String fileName, JsonNode expectedRows, List<ImportRowDto> actual) {
        assertThat(actual).as(fileName + " row count").hasSize(expectedRows.size());
        for (int i = 0; i < actual.size(); i++) {
            JsonNode e = expectedRows.get(i);
            ImportRowDto a = actual.get(i);
            String where = fileName + " row index " + i;
            assertThat(a.rowNumber()).as(where + " number").isEqualTo(e.path("rowNumber").asInt());
            assertThat(a.values().get(ScheduleFileReader.K_DATE)).as(where + " date").isEqualTo(e.path("date").asText());
            assertThat(a.values().get(ScheduleFileReader.K_TIME)).as(where + " time").isEqualTo(e.path("time").asText());
            assertThat(a.values().get(ScheduleFileReader.K_HOME)).as(where + " home").isEqualTo(e.path("home").asText());
            assertThat(a.values().get(ScheduleFileReader.K_AWAY)).as(where + " away").isEqualTo(e.path("away").asText());
            assertThat(a.values().get(ScheduleFileReader.K_VENUE)).as(where + " venue").isEqualTo(e.path("venue").asText());
        }
    }

    private static void assertDatesAndTimes(String fileName, JsonNode expected, List<ImportRowDto> rows) {
        for (ImportRowDto row : rows) {
            String key = String.valueOf(row.rowNumber());
            if (expected.has("isoDates")) {
                var date = ScheduleDateParser.parseText(String.valueOf(row.values().get(ScheduleFileReader.K_DATE)));
                assertThat(date.ok()).as(fileName + " date of row " + key).isTrue();
                assertThat(date.date().toString()).as(fileName + " date of row " + key)
                        .isEqualTo(expected.path("isoDates").path(key).asText());
            }
            if (expected.has("times")) {
                var time = ScheduleTimeParser.parseText(String.valueOf(row.values().get(ScheduleFileReader.K_TIME)));
                assertThat(time.ok()).as(fileName + " time of row " + key).isTrue();
                assertThat(time.time().toString()).as(fileName + " time of row " + key)
                        .isEqualTo(expected.path("times").path(key).asText());
            }
        }
    }

    private static void assertCodes(String fileName, JsonNode expected, List<ImportRowDto> rows) {
        Map<String, ResolvedSide> sides = new LinkedHashMap<>();
        List<Row> inputs = new ArrayList<>();
        for (ImportRowDto row : rows) {
            String home = String.valueOf(row.values().get(ScheduleFileReader.K_HOME));
            String away = String.valueOf(row.values().get(ScheduleFileReader.K_AWAY));
            inputs.add(new Row(row.rowNumber(), row.sourceRef(),
                    ScheduleDateParser.parseText(String.valueOf(row.values().get(ScheduleFileReader.K_DATE))),
                    ScheduleTimeParser.parseText(String.valueOf(row.values().get(ScheduleFileReader.K_TIME))),
                    home, away, String.valueOf(row.values().get(ScheduleFileReader.K_VENUE)),
                    side(sides, home), side(sides, away), false));
        }
        Result result = LeagueScheduleValidator.validate(inputs, ScheduleTestSupport.ctx(ImportScopeMode.ALL));
        for (RowResult r : result.rows()) {
            List<String> want = new ArrayList<>();
            expected.path("rowCodes").path(String.valueOf(r.rowNumber())).forEach(n -> want.add(n.asText()));
            assertThat(r.issueCodes().stream().sorted().toList()).as(fileName + " codes of row " + r.rowNumber())
                    .isEqualTo(want.stream().sorted().toList());
        }
        List<String> wantFile = new ArrayList<>();
        expected.path("fileCodes").forEach(n -> wantFile.add(n.asText()));
        List<String> gotFile = result.issues().stream().filter(i -> i.rowNumbers().isEmpty())
                .map(i -> i.code()).sorted().toList();
        assertThat(gotFile).as(fileName + " file-level codes").isEqualTo(wantFile.stream().sorted().toList());
    }

    private static ResolvedSide side(Map<String, ResolvedSide> sides, String name) {
        return sides.computeIfAbsent(TeamNameMatcher.normalise(name), k -> ScheduleTestSupport.league(name));
    }

    private static void assertProposals(String fileName, JsonNode expected, List<ImportRowDto> rows) {
        List<TeamCandidate> candidates = new ArrayList<>();
        expected.path("candidates").forEach(n -> candidates.add(new TeamCandidate(CandidateSource.LEAGUE_THIS_SEASON,
                "LEAGUE_TEAM", UUID.randomUUID(), n.asText(), null, null, null, true, false)));
        Map<String, String> names = new LinkedHashMap<>();
        rows.forEach(r -> {
            names.putIfAbsent(String.valueOf(r.values().get(ScheduleFileReader.K_HOME)), "");
            names.putIfAbsent(String.valueOf(r.values().get(ScheduleFileReader.K_AWAY)), "");
        });
        Map<String, List<TeamProposal>> actual = new TeamNameMatcher().proposeAll(names.keySet(), candidates, List.of());
        expected.path("proposals").fields().forEachRemaining(entry -> {
            List<TeamProposal> linkable = actual.get(entry.getKey()).stream().filter(TeamProposal::linkable).toList();
            if (entry.getValue().isNull()) {
                assertThat(linkable).as(fileName + " proposals for " + entry.getKey()).isEmpty();
                return;
            }
            assertThat(linkable).as(fileName + " proposals for " + entry.getKey()).isNotEmpty();
            TeamProposal top = linkable.get(0);
            assertThat(top.targetName()).as(fileName + " " + entry.getKey()).isEqualTo(entry.getValue().path("target").asText());
            assertThat(top.confidence()).as(fileName + " " + entry.getKey()).isEqualTo(entry.getValue().path("confidence").asInt());
            assertThat(top.preselected()).as(fileName + " " + entry.getKey()).isEqualTo(entry.getValue().path("preselected").asBoolean());
        });
    }
}
