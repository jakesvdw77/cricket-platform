package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.exception.ImportInputValidationException;
import java.util.ArrayList;
import java.util.List;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md, "A line reader, not a CSV library": the text of a CricClubs
 * report split into numbered lines, each of which can be cut into cells. The report mixes free text, tabs and rows of
 * different widths, so this only splits on commas, honours double quotes (a name containing a comma), trims spaces and
 * tabs, and remembers the line number so every error can name it. Line numbers count the physical lines of the text
 * after any byte order mark, from 1.
 */
final class CricClubsLines {

    private CricClubsLines() {}

    /** One physical line: its 1-based number and its text with tabs and spaces trimmed from both ends. */
    record Line(int number, String text) {

        boolean isBlank() {
            return text.isEmpty();
        }

        /** The comma separated cells, quotes removed and each cell trimmed. An unclosed quote is an error on this line. */
        List<String> cells() {
            List<String> cells = new ArrayList<>();
            StringBuilder cell = new StringBuilder();
            boolean quoted = false;
            for (int i = 0; i < text.length(); i++) {
                char c = text.charAt(i);
                if (quoted) {
                    if (c == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else if (c == '"') {
                        quoted = false;
                    } else {
                        cell.append(c);
                    }
                } else if (c == '"') {
                    quoted = true;
                } else if (c == ',') {
                    cells.add(trim(cell));
                    cell.setLength(0);
                } else {
                    cell.append(c);
                }
            }
            if (quoted) {
                throw new ImportInputValidationException(
                        "The file is not a CricClubs scorecard this adaptor can read.",
                        List.of(new ImportErrorDto(path(number), "UNCLOSED_QUOTE",
                                "A double quote is opened but never closed.")));
            }
            cells.add(trim(cell));
            return cells;
        }
    }

    /** Splits on any line ending (Windows, Unix or old Mac), removes a leading byte order mark and trims each line. */
    static List<Line> of(String text) {
        String body = text.startsWith("\uFEFF") ? text.substring(1) : text;
        String[] raw = body.split("\r\n|\n|\r", -1);
        List<Line> lines = new ArrayList<>(raw.length);
        for (int i = 0; i < raw.length; i++) {
            lines.add(new Line(i + 1, trim(raw[i])));
        }
        return lines;
    }

    /** The error path of a line: {@code line 17}. */
    static String path(int number) {
        return "line " + number;
    }

    /** Trims spaces, tabs and the non-breaking space from both ends. */
    private static String trim(CharSequence text) {
        int start = 0;
        int end = text.length();
        while (start < end && isPad(text.charAt(start))) {
            start++;
        }
        while (end > start && isPad(text.charAt(end - 1))) {
            end--;
        }
        return text.subSequence(start, end).toString();
    }

    private static boolean isPad(char c) {
        return c == ' ' || c == '\t' || c == '\u00A0';
    }
}
