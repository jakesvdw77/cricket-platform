package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.ImportTemplateScope;
import com.cricketlegend.service.support.CsvTemplateWriter;
import com.cricketlegend.service.support.TemplateFormat;
import com.cricketlegend.service.support.XlsxTemplateWriter;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Builds the league schedule template (docs/specs/098-league-schedule-import.md, "The template"): the {@code Schedule}
 * sheet (header only), {@code Instructions} with the worked example row (never on the data sheet), {@code Lookups} for
 * the chosen template scope with warn-only drop-downs, and the hidden {@code _meta}. A CSV is the header row only.
 */
public final class ScheduleTemplateWriter {

    private static final int LAST_ROW = 1001;

    private ScheduleTemplateWriter() {}

    /** A team name offered on the Lookups sheet; {@code seasonLabel} is set for a name from an earlier season. */
    public record Named(String name, String seasonLabel) {}

    /** Everything the writer needs (names only, no ids except in the hidden meta). */
    public record Data(
            String clubId,
            String leagueId,
            String seasonId,
            String leagueName,
            String seasonLabel,
            ImportTemplateScope templateScope,
            List<String> ourTeams,
            List<String> leagueTeamsThisSeason,
            List<Named> leagueTeamsPreviousSeasons,
            List<String> knownVenues) {}

    public static byte[] build(Data data, TemplateFormat format) {
        if (format == TemplateFormat.CSV) {
            return CsvTemplateWriter.header(ScheduleFileReader.HEADERS);
        }
        boolean others = data.templateScope() == ImportTemplateScope.OURS_AND_OTHERS;
        Map<String, List<String>> lookups = new LinkedHashMap<>();
        lookups.put("Our teams", data.ourTeams());
        int teamColumn = 0;
        if (others) {
            lookups.put("League teams this season", data.leagueTeamsThisSeason());
            lookups.put("League teams from previous seasons",
                    data.leagueTeamsPreviousSeasons().stream().map(Named::name).toList());
            lookups.put("Previous season", data.leagueTeamsPreviousSeasons().stream()
                    .map(n -> n.seasonLabel() == null ? "" : n.seasonLabel()).toList());
            List<String> all = allTeamNames(data);
            lookups.put("All team names (drop-down)", all);
            teamColumn = lookups.size() - 1;
        }
        lookups.put("Known venues", data.knownVenues());
        int venueColumn = lookups.size() - 1;
        int teamCount = lookups.get(others ? "All team names (drop-down)" : "Our teams").size();

        Map<String, String> meta = new LinkedHashMap<>();
        meta.put("template", ScheduleFileReader.TYPE);
        meta.put("version", String.valueOf(ScheduleFileReader.TEMPLATE_VERSION));
        meta.put("clubId", data.clubId());
        meta.put("leagueId", data.leagueId());
        meta.put("seasonId", data.seasonId());
        meta.put("templateScope", data.templateScope().name());
        meta.put("generatedAt", Instant.now().toString());

        return XlsxTemplateWriter.create()
                .dataSheet(ScheduleFileReader.DATA_SHEET, ScheduleFileReader.HEADERS)
                .dateColumn(ScheduleFileReader.DATA_SHEET, 0, LAST_ROW, "yyyy-mm-dd")
                .warnOnlyDate(ScheduleFileReader.DATA_SHEET, 0, LAST_ROW, "Enter a date, for example 2026-09-13")
                .timeColumn(ScheduleFileReader.DATA_SHEET, 1, LAST_ROW, "hh:mm")
                .warnOnlyTime(ScheduleFileReader.DATA_SHEET, 1, LAST_ROW, "Enter a time, for example 08:00")
                .instructions("Instructions", instructions(data),
                        ScheduleFileReader.HEADERS,
                        List.of("2026-09-13", "08:00", "Irene Villagers 1", "Brits Vets 1", "Brits Oval",
                                "Optional note for whoever checks the file"))
                .lookups("Lookups", lookups)
                .warnOnlyList(ScheduleFileReader.DATA_SHEET, 2, LAST_ROW, "Lookups", teamColumn, teamCount)
                .warnOnlyList(ScheduleFileReader.DATA_SHEET, 3, LAST_ROW, "Lookups", teamColumn, teamCount)
                .warnOnlyList(ScheduleFileReader.DATA_SHEET, 4, LAST_ROW, "Lookups", venueColumn,
                        lookups.get("Known venues").size())
                .meta(meta)
                .toBytes();
    }

    private static List<String> allTeamNames(Data data) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> all = new ArrayList<>();
        List<String> sources = new ArrayList<>(data.ourTeams());
        sources.addAll(data.leagueTeamsThisSeason());
        data.leagueTeamsPreviousSeasons().forEach(n -> sources.add(n.name()));
        for (String name : sources) {
            if (name != null && !name.isBlank() && seen.add(name.trim().toLowerCase(Locale.ROOT))) {
                all.add(name.trim());
            }
        }
        return all;
    }

    private static List<String> instructions(Data data) {
        List<String> lines = new ArrayList<>();
        lines.add("Schedule import for " + data.leagueName() + ", " + data.seasonLabel()
                + ". Fill the Schedule sheet, save it, and upload it in the application. Nothing is saved until you confirm.");
        lines.add("Date: the match day, for example 2026-09-13. Other forms are accepted: 13/09/2026, 13/9/26, 13.09.2026, "
                + "2026/09/13, 13 Sep 2026, 13th September 2026, September 13, 2026, 13Sep2026 and 13-Sept-26, with or "
                + "without a weekday. Numeric dates are read day first. A date written without a year (13 Sep, 13/09) "
                + "takes its year from the season.");
        lines.add("Home team and Away team: the teams as they are written in your source. Copy the names exactly; "
                + "you will check every team name in the next step.");
        lines.add("Venue: the ground as written in the source. It may be left empty (you will get a warning).");
        lines.add("Start Time: the local start time, for example 08:00 or 14:30. Also accepted: 8:00, 8.00, 14h30 and 2:30 pm.");
        lines.add("Notes: free text for whoever checks the file. It is shown next to the row and is never saved on the match.");
        lines.add("Rules: one row per match; do not merge cells; repeat the date on every row; no blank separator rows.");
        lines.add("Limits: at most 1,000 rows and 2 MB. Template version " + ScheduleFileReader.TEMPLATE_VERSION + ".");
        lines.add("The drop-downs only help: a name that is not in the list is accepted and resolved in the next step.");
        return lines;
    }
}
