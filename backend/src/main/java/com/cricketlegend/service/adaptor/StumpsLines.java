package com.cricketlegend.service.adaptor;

import java.util.ArrayList;
import java.util.List;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md, "Backend design": the text of a STUMPS report as numbered lines,
 * which is all the pure parser knows of the PDF. Each line carries the page it was on and its physical line number on
 * that page (counting blank lines, which are then left out), so every error can say {@code page 2, line 14}. Built by
 * {@link StumpsPdfText} from a PDF, or by {@link #ofText} from plain text (pages separated by a form feed) for tests.
 */
final class StumpsLines {

    private StumpsLines() {}

    /** One non-blank line: its 1-based page, its 1-based line number on the page, and its text with white space trimmed. */
    record Line(int page, int number, String text) {

        /** The error path of this line: {@code page 2, line 14}. */
        String path() {
            return "page " + page + ", line " + number;
        }
    }

    /** The lines of the pages, in order, with each line trimmed and the blank lines dropped. */
    static List<Line> ofPages(List<String> pageTexts) {
        List<Line> lines = new ArrayList<>();
        for (int p = 0; p < pageTexts.size(); p++) {
            String[] raw = pageTexts.get(p).split("\r\n|\n|\r", -1);
            int number = 0;
            for (String line : raw) {
                String text = trim(line);
                if (!text.isEmpty()) {
                    number++;
                    lines.add(new Line(p + 1, number, text));
                }
            }
        }
        return lines;
    }

    /** Plain text as lines, a form feed (U+000C) starting a new page. */
    static List<Line> ofText(String text) {
        return ofPages(List.of(text.split("\f", -1)));
    }

    /** Trims spaces, tabs and the non-breaking space, and turns every run of them inside the line into one space. */
    private static String trim(String text) {
        return text.replace(' ', ' ').replaceAll("[ \t]+", " ").trim();
    }
}
