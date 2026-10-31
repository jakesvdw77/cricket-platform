package com.cricketlegend.service.support.schedule;

import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.exception.ImportFileRejectedException;
import com.cricketlegend.service.support.CsvTableReader;
import com.cricketlegend.service.support.ImportFile;
import com.cricketlegend.service.support.ImportFileKind;
import com.cricketlegend.service.support.ImportScope;
import com.cricketlegend.service.support.ParsedImport;
import com.cricketlegend.service.support.TableData;
import com.cricketlegend.service.support.TableRow;
import com.cricketlegend.service.support.XlsxTableReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads a league schedule file into rows of text (docs/specs/098-league-schedule-import.md, "The template"): the sheet
 * {@code Schedule} (xlsx) or the first table (CSV), the header aliases of the spec, the hidden {@code _meta} version
 * and template check, and merged cells refused by the shared reader. Cell values stay text here; the date, time and
 * team rules are applied by the validator, so a re-validation needs only the stored row values. Never logs or quotes
 * a cell.
 */
public final class ScheduleFileReader {

    public static final String TYPE = "LEAGUE_SCHEDULE";
    public static final int TEMPLATE_VERSION = 1;
    public static final String DATA_SHEET = "Schedule";

    public static final String DATE = "Date";
    public static final String HOME = "Home team";
    public static final String AWAY = "Away team";
    public static final String VENUE = "Venue";
    public static final String TIME = "Start Time";
    public static final String NOTES = "Notes";

    /** The template's header row, in order. */
    public static final List<String> HEADERS = List.of(DATE, TIME, HOME, AWAY, VENUE, NOTES);

    private static final List<String> REQUIRED = List.of(DATE, HOME, AWAY, TIME);

    /** Row value keys (the stored row's {@code values}). */
    public static final String K_DATE = "date";
    public static final String K_HOME = "home";
    public static final String K_AWAY = "away";
    public static final String K_VENUE = "venue";
    public static final String K_TIME = "time";
    public static final String K_NOTES = "notes";

    /** Meta key set to {@code true} when the template was generated for another league or season. */
    public static final String META_SCOPE_MISMATCH = "scopeMismatch";

    private static final Map<String, List<String>> ALIASES = aliases();

    private ScheduleFileReader() {}

    private static Map<String, List<String>> aliases() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        map.put(DATE, List.of("Match date"));
        map.put(HOME, List.of("Home", "Team 1", "Team1", "First team"));
        map.put(AWAY, List.of("Away", "Team 2", "Team2", "Second team"));
        map.put(VENUE, List.of("Ground", "Field"));
        map.put(TIME, List.of("Start", "Time", "Start time"));
        map.put(NOTES, List.of("Note", "Comments"));
        return map;
    }

    public static ParsedImport read(ImportFile file, ImportScope scope) {
        TableData table = file.kind() == ImportFileKind.XLSX
                ? XlsxTableReader.read(file.content(), DATA_SHEET, ALIASES)
                : CsvTableReader.read(file.content(), ALIASES);
        Map<String, String> meta = new LinkedHashMap<>();
        checkTemplate(table.meta());
        meta.putAll(table.meta());
        List<String> missing = table.missingColumns(REQUIRED);
        if (!missing.isEmpty()) {
            throw new ImportFileRejectedException("This file is missing the column" + (missing.size() > 1 ? "s " : " ")
                    + String.join(", ", missing) + ". Download the latest template and use its header row.");
        }
        if (table.meta().containsKey("leagueId") || table.meta().containsKey("seasonId")) {
            boolean mismatch = !same(table.meta().get("leagueId"), scope.param("leagueId"))
                    || !same(table.meta().get("seasonId"), scope.param("seasonId"));
            meta.put(META_SCOPE_MISMATCH, String.valueOf(mismatch));
        }
        List<ImportRowDto> rows = new ArrayList<>(table.rows().size());
        for (TableRow row : table.rows()) {
            Map<String, Object> values = new LinkedHashMap<>();
            values.put(K_DATE, row.value(DATE));
            values.put(K_HOME, collapse(row.value(HOME)));
            values.put(K_AWAY, collapse(row.value(AWAY)));
            values.put(K_VENUE, collapse(row.value(VENUE)));
            values.put(K_TIME, row.value(TIME));
            values.put(K_NOTES, row.value(NOTES));
            rows.add(new ImportRowDto(row.rowNumber(), row.sourceRef(), values, null, null, null, List.of(), null));
        }
        return new ParsedImport(rows, table.warnings(), meta);
    }

    /** The hidden {@code _meta} sheet, when present, must be this type at this version (an xlsx only). */
    private static void checkTemplate(Map<String, String> meta) {
        if (meta.isEmpty()) {
            return;
        }
        String template = meta.get("template");
        if (template != null && !TYPE.equals(template)) {
            throw new ImportFileRejectedException("This file was made from a different template. Download the schedule template.");
        }
        String version = meta.get("version");
        if (version != null && !String.valueOf(TEMPLATE_VERSION).equals(version.trim())) {
            throw new ImportFileRejectedException("This template is from a different version. Download the latest template.");
        }
    }

    private static boolean same(String a, String b) {
        return a == null || b == null || a.trim().equalsIgnoreCase(b.trim());
    }

    private static String collapse(String text) {
        return text == null ? "" : text.trim().replaceAll("\\s+", " ");
    }
}
