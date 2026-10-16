package com.cricketlegend.support;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md, Test Plan "Masked fixtures only": a STUMPS match report built from a
 * template that follows the real line structure (a banner on every page, the summary, a batting card per innings with a
 * name line, a dismissal line and a figures line per batter, extras, total, fall of wickets, a bowling table, then
 * ball-by-ball pages) but is entirely invented: placeholder names ({@code Player 1}, {@code Team A U15}), a placeholder
 * match id and fictional numbers. No real report is ever committed. {@link #text()} is the plain text a parser sees (a
 * form feed starts a new page); {@link #pdf} draws such text into a small PDF with PDFBox. Tests make a variant with
 * {@code text().replace(...)}.
 *
 * <p>The default report is consistent cricket: Team A U15 bat first, 105/6 in 20 overs (eight batters); Team B U15 reply
 * 111/4 in 17.3 overs (six batters) and win by 6 wickets. Every dismissal form the adaptor knows appears once.
 */
public final class StumpsPdfFixtures {

    public static final String BANNER = """
            Download 'STUMPS - The Cricket Scorer' app from Android's Play Store or Apple's App Store
            Match report created from
            STUMPS
            """;

    public static final String TEAM_A = "Team A U15";
    public static final String TEAM_B = "Team B U15";
    public static final String MATCH_ID = "tst00001";

    private static final String PAGE_1 = BANNER + """
            Match Report
            Team A U15
            105-6 in 20.0 overs
            Team B U15
            111-4 in 17.3 overs
            Result
            Team B U15 won by 6 wickets
            Player Of The Match
            -
            Match Information
            Organiser Placeholder Organiser
            Match Title Open Match
            Match Format Club Cricket
            Playing 11 Per Side
            Overs 20
            Venue Placeholder Ground
            Date & Time 21 Nov 2026 01:30 PM
            Toss Team A U15 Opted To Bat
            Scorer Placeholder Scorer
            Match ID tst00001
            Match Summary
            Team A U15 105-6 (20.0)
            Player 7 30*(22) Player 14 3-22
            Player 1 20(25) Player 16 2-15
            Team B U15 111-4 (17.3)
            Player 18 50*(40) Player 1 2-25
            Player 15 20(18) Player 3 1-22
            """;

    private static final String PAGE_2 = BANNER + """
            1st Innings Scorecard
            Team A U15 R B 4s 6s SR
            Player 1
            b Player 14
            20 25 2 0 80.0
            Player 2
            c Player 15 b Player 14
            15 20 1 0 75.0
            Player 3
            c & b Player 16
            10 12 1 0 83.3
            Player 4
            lbw Player 14
            8 10 0 0 80.0
            Player 5
            runout (Player 17)
            5 6 0 0 83.3
            Player 6
            b Player 16
            2 4 0 0 50.0
            Player 7
            not out
            30 22 3 1 136.4
            Player 8
            not out
            5 5 0 0 100.0
            Extras
            ( B 2 | LB 1 | WD 6 | NB 1 )
            10 Overs 20.0
            Total
            105/6
            Run Rate 5.3
            Fall Of Wickets
            20-1 (Player 1, 4.2), 35-2 (Player 2, 7.1), 48-3 (Player 3, 9.5), 60-4 (Player 4, 12.0), 68-5 (Player 5,
            14.3), 70-6 (Player 6, 15.1)
            """;

    private static final String PAGE_3 = BANNER + """
            Bowler O M R W Eco 0s 4s 6s Wd NB
            Player 14 4.0 0 22 3 5.5 14 2 0 2 0
            Player 15 4.0 0 20 0 5.0 12 1 0 1 0
            Player 16 4.0 1 15 2 3.8 16 1 0 1 0
            Player 17 4.0 0 18 0 4.5 13 2 0 1 0
            Player 18 4.0 0 27 0 6.8 10 3 1 1 1
            2nd Innings Scorecard
            Team B U15 R B 4s 6s SR
            Player 14
            c Player 2 b Player 1
            12 15 1 0 80.0
            Player 15
            b Player 3
            20 18 2 0 111.1
            Player 16
            lbw Player 1
            4 9 0 0 44.4
            Player 17
            runout (Player 5)
            6 5 1 0 120.0
            Player 18
            not out
            50 40 6 1 125.0
            Player 19
            not out
            14 10 2 0 140.0
            Extras
            ( LB 2 | WD 3 )
            5 Overs 17.3
            Total
            111/4
            Run Rate 6.3
            Fall Of Wickets
            18-1 (Player 14, 3.3), 40-2 (Player 15, 7.0), 49-3 (Player 16, 9.2), 60-4 (Player 17, 11.0)
            """;

    private static final String PAGE_4 = BANNER + """
            Bowler O M R W Eco 0s 4s 6s Wd NB
            Player 1 4.0 0 25 2 6.3 14 2 0 1 0
            Player 2 4.0 0 20 0 5.0 15 1 0 1 0
            Player 3 4.0 0 22 1 5.5 12 2 0 1 0
            Player 4 3.0 0 18 0 6.0 9 1 0 0 0
            Player 5 2.3 0 24 0 9.6 5 3 0 0 0
            """;

    /** The ball-by-ball pages, which no adaptor rule reads: lines of every shape that must never cause an error. */
    private static final String PAGE_5 = BANNER + """
            Over Comparison
            Team A U15 Team B U15
            Wd 0 0 0 2 1 Wd 0
            Player 1 3(5)
            Player 2 0(1)
            Player 14
            1.0 - 0 - 5 - 0
            Overs 1 Runs 5 Score 5-0
            0 1 4 Wd W 0 Wd 0
            Over 2 this line is not a scorecard line at all
            """;

    private StumpsPdfFixtures() {}

    /** The default report as plain text, a form feed between pages. */
    public static String text() {
        return String.join("\f", PAGE_1, PAGE_2, PAGE_3, PAGE_4, PAGE_5);
    }

    /** The default report as a PDF. */
    public static byte[] pdf() {
        return pdf(text());
    }

    /** A PDF whose pages draw the lines of the text, in order, one line to each line of text; a form feed starts a page. */
    public static byte[] pdf(String text) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String page : text.split("\f", -1)) {
                addPage(document, page.split("\r\n|\n|\r", -1));
            }
            document.save(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /**
     * The text as a PDF encrypted with a user password ({@code ""} for none, so it opens without one) and a different
     * owner password.
     */
    public static byte[] encryptedPdf(String text, String userPassword) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String page : text.split("\f", -1)) {
                addPage(document, page.split("\r\n|\n|\r", -1));
            }
            StandardProtectionPolicy policy = new StandardProtectionPolicy("owner-secret-1", userPassword, new AccessPermission());
            policy.setEncryptionKeyLength(128);
            document.protect(policy);
            document.save(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /** A PDF of {@code pages} blank pages, with no text at all (what a scan looks like to a text reader). */
    public static byte[] blankPdf(int pages) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 0; i < pages; i++) {
                document.addPage(new PDPage(PDRectangle.A4));
            }
            document.save(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /** {@code pages} pages each with one line of text, for the page cap. */
    public static byte[] pdfOfPages(int pages) {
        return pdf(String.join("\f", java.util.Collections.nCopies(pages, "A line of text")));
    }

    /** The error path ({@code page N, line M}) of the first line equal to {@code line} in a text, counting the lines of text on each page. */
    public static String pathOf(String text, String line) {
        String[] pages = text.split("\f", -1);
        for (int p = 0; p < pages.length; p++) {
            int number = 0;
            for (String candidate : pages[p].split("\r\n|\n|\r", -1)) {
                if (!candidate.isBlank()) {
                    number++;
                }
                if (candidate.trim().equals(line)) {
                    return "page " + (p + 1) + ", line " + number;
                }
            }
        }
        throw new AssertionError("no line '" + line + "' in the fixture");
    }

    /** The lines of a text with the blank ones dropped, trimmed, for comparing with what the PDF reader returned. */
    public static List<String> nonBlankLines(String text) {
        return java.util.Arrays.stream(text.split("\f|\r\n|\n|\r")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static void addPage(PDDocument document, String[] lines) throws IOException {
        PDPage page = new PDPage(PDRectangle.A4);
        document.addPage(page);
        float leading = Math.min(12f, 800f / Math.max(1, lines.length));
        float size = Math.min(9f, leading - 1f);
        PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        try (PDPageContentStream content = new PDPageContentStream(document, page)) {
            content.beginText();
            content.setFont(font, size);
            content.newLineAtOffset(20, 820);
            for (String line : lines) {
                if (!line.isBlank()) {
                    content.showText(line);
                }
                content.newLineAtOffset(0, -leading);
            }
            content.endText();
        }
    }
}
