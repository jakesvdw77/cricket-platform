package com.cricketlegend.service.support;

import com.cricketlegend.exception.ImportFileRejectedException;
import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

/**
 * The one CSV reader every import handler uses (docs/specs/097-import-framework.md, "Parsing"): UTF-8 (a BOM is
 * tolerated, anything else is refused rather than guessed), comma or semicolon sniffed from the header line, RFC 4180
 * quoting, the same header aliases, trimming, blank-row dropping and cell and row limits as {@link XlsxTableReader}.
 * A CSV carries no {@code _meta}, so {@link TableData#meta()} is empty.
 */
public final class CsvTableReader {

    private CsvTableReader() {
    }

    public static TableData read(byte[] content, Map<String, List<String>> columnAliases) {
        String text = decode(content);
        char delimiter = sniffDelimiter(text);
        TableHeaders headers = new TableHeaders(columnAliases);
        List<String> warnings = new ArrayList<>();
        CSVFormat format = CSVFormat.DEFAULT.builder().setDelimiter(delimiter).setIgnoreEmptyLines(true).get();
        try (CSVParser parser = CSVParser.parse(new StringReader(text), format)) {
            Map<Integer, String> columnByIndex = new LinkedHashMap<>();
            List<String> found = new ArrayList<>();
            List<String> unknown = new ArrayList<>();
            List<TableRow> rows = new ArrayList<>();
            boolean headerRead = false;
            for (CSVRecord record : parser) {
                long line = parser.getCurrentLineNumber();
                if (!headerRead) {
                    if (isBlank(record)) {
                        continue;
                    }
                    headerRead = true;
                    Map<String, Integer> seen = TableHeaders.newSeen();
                    for (int i = 0; i < record.size(); i++) {
                        String name = record.get(i).trim();
                        if (name.isEmpty()) {
                            continue;
                        }
                        String canonical = headers.canonical(name);
                        if (canonical == null) {
                            unknown.add(name);
                            continue;
                        }
                        TableHeaders.rejectDuplicate(seen, canonical);
                        seen.put(canonical, i);
                        columnByIndex.put(i, canonical);
                        found.add(canonical);
                    }
                    continue;
                }
                if (isBlank(record)) {
                    continue;
                }
                if (rows.size() >= ImportLimits.MAX_ROWS) {
                    throw new ImportFileRejectedException("The file has more than 1,000 data rows. Split it into smaller files.");
                }
                Map<String, String> values = new LinkedHashMap<>();
                Map<String, String> refs = new LinkedHashMap<>();
                String firstRef = null;
                for (Map.Entry<Integer, String> column : columnByIndex.entrySet()) {
                    String ref = "line " + line + ", column " + (column.getKey() + 1);
                    String cell = column.getKey() < record.size() ? record.get(column.getKey()).trim() : "";
                    if (cell.length() > ImportLimits.MAX_CELL_CHARACTERS) {
                        cell = cell.substring(0, ImportLimits.MAX_CELL_CHARACTERS);
                        warnings.add("The value at " + ref + " was longer than 1,000 characters and was cut short.");
                    }
                    values.put(column.getValue(), cell);
                    refs.put(column.getValue(), ref);
                    if (firstRef == null && !cell.isEmpty()) {
                        firstRef = ref;
                    }
                }
                rows.add(new TableRow((int) line, firstRef == null ? "line " + line : firstRef, values, refs));
            }
            if (!headerRead) {
                throw new ImportFileRejectedException("The file is empty: the header row was not found.");
            }
            return new TableData(found, unknown, rows, Map.of(), warnings);
        } catch (ImportFileRejectedException ex) {
            throw ex;
        } catch (IOException | UncheckedIOException | IllegalArgumentException ex) {
            throw new ImportFileRejectedException("The CSV file could not be read. Check it is a valid UTF-8 CSV.");
        }
    }

    private static String decode(byte[] content) {
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(content))
                    .toString();
            return text.startsWith("﻿") ? text.substring(1) : text;
        } catch (CharacterCodingException ex) {
            throw new ImportFileRejectedException("The CSV file is not UTF-8. Save it as 'CSV UTF-8' and try again.");
        }
    }

    private static char sniffDelimiter(String text) {
        int end = text.indexOf('\n');
        String header = end < 0 ? text : text.substring(0, end);
        long semicolons = header.chars().filter(c -> c == ';').count();
        long commas = header.chars().filter(c -> c == ',').count();
        return semicolons > commas ? ';' : ',';
    }

    private static boolean isBlank(CSVRecord record) {
        for (String value : record) {
            if (!value.trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }
}
