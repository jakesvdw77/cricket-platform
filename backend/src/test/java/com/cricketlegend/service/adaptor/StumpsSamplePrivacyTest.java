package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md Test Plan, "Privacy check": the real reports name children, so no
 * name, team, venue or match id from them may appear in the STUMPS adaptor's tests and fixtures or in spec 108 and its
 * plan, and no real match id may appear anywhere under {@code src/test}. The list is read from the git-ignored
 * {@code docs/samples} (the STUMPS PDFs and the CricClubs CSVs) when that folder is present and the test is skipped when
 * it is not (CI). The test never prints a name: a failure lists file paths and counts only.
 *
 * <p>Scope: names, teams and venues are checked in the files this feature owns, not in every older test. The earlier
 * import work legitimately names the operator's own club and ground, and a first name such as a common one can coincide
 * with a real player's, so a whole-tree name scan would flag files this feature never touched. A match id is distinctive
 * and is checked across the whole of {@code src/test}.
 */
class StumpsSamplePrivacyTest {

    private static final Pattern FIGURES = Pattern.compile("^\\d+ \\d+ \\d+ \\d+ \\S+$");
    private static final Pattern NUMERIC = Pattern.compile("^[\\d.\\-,]+$");
    private static final Pattern SCORE_LINE = Pattern.compile("^\\d+-\\d+ in [\\d.]+ overs?$");
    private static final Pattern LABELLED = Pattern.compile("^(Organiser|Venue|Scorer|Match ID) (.+)$");
    private static final Pattern FALL_OF_WICKET = Pattern.compile("\\(([^,()]+), \\d+\\.\\d\\)");
    private static final Pattern TOP_PERFORMER = Pattern.compile("([\\p{L}'. ]+?) \\d+\\*?\\(\\d+\\)(?: ([\\p{L}'. ]+?) \\d+-\\d+)?");
    private static final Pattern BALL_BY_BALL_BATTER = Pattern.compile("^(.+?) \\d+\\*?\\(\\d+\\)$");
    private static final Pattern DISMISSAL_NAMES = Pattern.compile("^(?:c & b|c|b|lbw|runout) (.+)$");
    private static final Pattern CARD_COLUMNS = Pattern.compile("^.+ R B 4s 6s SR$");
    private static final Pattern DISMISSAL_START = Pattern.compile(
            "^(not out|b .+|c .+|lbw .+|runout.*|st .+|stumped.*|hit .*|retired.*|timed .*|handled.*|obstruct.*|absent.*)$");
    private static final Pattern BOWLING_HEADER = Pattern.compile("^Bowler O M R W .*$");
    /**
     * Ordinary words of a report's structure and of the placeholder fixtures. A candidate whose every word is one of these
     * (or a number) is not a name, so a marker row such as "Did not bat" or the placeholder "Player 1" is never looked
     * for in the files under test.
     */
    private static final Set<String> STRUCTURE_WORDS = Set.of("did", "not", "bat", "out", "absent", "hurt", "retired",
            "yet", "to", "and", "extras", "total", "stumps", "player", "team", "placeholder", "b", "c", "lbw", "st", "ro",
            "run", "runout", "wd", "nb", "over", "overs", "dnb", "of", "the", "match", "innings", "scorecard");
    private static final Set<String> CSV_STRUCTURE = Set.of("batsman", "how out", "fielder", "bowler", "runs", "balls",
            "fours", "sixers", "overs", "madiens", "wickets", "wides", "no balls", "hattricks", "dot balls", "total",
            "substitute", "not out", "b", "ct", "ctw", "lbw", "st", "ro", "rt", "rtno");

    // ---- the scanner proves itself on a planted name, so a pass is not an empty scan ----

    @Test
    void theScannerFindsAPlantedNameWhateverItsCaseAndNeverAPartOfAWord() {
        Set<String> names = Set.of("zed quillfeather", "marlowe");

        assertThat(mentions("The scorer was ZED   Quillfeather today", names)).isTrue();
        assertThat(mentions("Zed\tQuillfeather", names)).isTrue();
        assertThat(mentions("Marlowe's innings", names)).isTrue();
        assertThat(mentions("Marlowesque", names)).as("part of a longer word is not a hit").isFalse();
        assertThat(mentions("Player 1 and Team A U15", names)).isFalse();
    }

    @Test
    void anAccentedNameIsFoundWithOrWithoutItsAccents() {
        Set<String> names = stumpsNames(String.join("\n", "Zo\u00eb M\u00fcller", "b Idris Okonkwo", "1 2 0 0 50.0"));

        assertThat(names).contains("zoe muller");
        assertThat(mentions("Zo\u00eb M\u00fcller scored", names)).isTrue();
        assertThat(mentions("ZOE MULLER scored", names)).isTrue();
        assertThat(mentions("Zoe Mu\u0308ller scored", names)).as("a decomposed accent is the same name").isTrue();
        assertThat(mentions("Zoey Muller", names)).isFalse();
    }

    @Test
    void aBatterWhoseNameIsTwoOrThreeLettersIsKeptButAnOrdinaryWordOrAPlaceholderIsNot() {
        Set<String> names = stumpsNames(String.join("\n",
                "Jo", "b Idris Okonkwo", "1 2 0 0 50.0",
                "Ray", "not out", "3 4 0 0 75.0",
                "Did not bat", "Player 1", "not out", "5 6 0 0 83.3"));

        assertThat(names).contains("jo", "ray", "idris okonkwo");
        assertThat(names).doesNotContain("did not bat", "player 1", "not out");
        assertThat(mentions("Jo scored fifty", names)).isTrue();
        assertThat(mentions("Joint effort", names)).isFalse();
    }

    @Test
    void aNameThatWrapsOverLinesIsHarvestedWhole() {
        Set<String> names = stumpsNames(String.join("\n",
                "Team Zeta R B 4s 6s SR",
                "Marlowe", "Vance Of Quill", "c Idris Okonkwo b", "Zed Quillfeather", "1 2 0 0 50.0",
                "Extras", "( )", "0 Overs 1.0", "Total", "1/1", "Run Rate 1.0",
                "Fall Of Wickets", "1-1 (Ayesha", "Karimova, 0.3)",
                "Bowler O M R W Eco 0s 4s 6s Wd NB"));

        assertThat(names).contains("marlowe vance of quill", "zed quillfeather",
                "idris okonkwo", "ayesha karimova");
    }

    @Test
    void nameHarvestingReadsEveryPlaceAReportPutsAName() {
        String report = String.join("\n",
                "Team Zeta Alphas", "10-1 in 2.0 overs",
                "Venue Quillfeather Oval", "Match ID zz99aa00",
                "Zed Quillfeather", "c Marlowe Vance b Idris Okonkwo", "1 2 0 0 50.0",
                "Idris Okonkwo 4.0 0 22 3 5.5 14 2 0 2 0",
                "10-1 (Zed Quillfeather, 4.2)",
                "Player Of The Match", "Zuri Ndlovu", "Match Information");

        Set<String> names = stumpsNames(report);

        assertThat(names).contains("team zeta alphas", "quillfeather oval", "zz99aa00", "zed quillfeather",
                "marlowe vance", "idris okonkwo", "zuri ndlovu");
    }

    // ---- the real samples ----

    @Test
    void noNameFromTheGitIgnoredSamplesAppearsInTheTestsOrSpec108() throws IOException {
        Path root = repositoryRoot();
        assumeTrue(root != null && Files.isDirectory(root.resolve("docs/samples")),
                "docs/samples is git-ignored and absent here, so there is nothing to compare with");
        Set<String> names = new TreeSet<>();
        try (Stream<Path> files = Files.walk(root.resolve("docs/samples/stumps"))) {
            for (Path pdf : files.filter(p -> p.toString().toLowerCase(Locale.ROOT).endsWith(".pdf")).toList()) {
                names.addAll(stumpsNames(pdfText(pdf)));
            }
        }
        try (Stream<Path> files = Files.walk(root.resolve("docs/samples/cricclubs"))) {
            for (Path csv : files.filter(p -> p.toString().toLowerCase(Locale.ROOT).endsWith(".csv")).toList()) {
                names.addAll(cricClubsNames(Files.readAllBytes(csv)));
            }
        }
        assumeTrue(!names.isEmpty(), "the samples folder has no STUMPS or CricClubs sample to compare with");
        assertThat(names.size()).as("the harvest finds the names of the samples, so a pass is not an empty scan")
                .isGreaterThan(30);

        Set<String> matchIds = new TreeSet<>();
        try (Stream<Path> files = Files.walk(root.resolve("docs/samples/stumps"))) {
            for (Path pdf : files.filter(p -> p.toString().toLowerCase(Locale.ROOT).endsWith(".pdf")).toList()) {
                matchIds.addAll(stumpsMatchIds(pdfText(pdf)));
            }
        }
        assertThat(matchIds).as("every sample has a match id to look for").isNotEmpty();

        List<String> leaks = new ArrayList<>();
        for (Path file : filesToCheck(root)) {
            String content = readLenient(file);
            long hits = (isOwned(file) ? names : matchIds).stream().filter(name -> mentions(content, Set.of(name))).count();
            if (hits > 0) {
                leaks.add(root.relativize(file) + " (" + hits + " names)");
            }
        }
        assertThat(leaks).as("files that contain a name, team, venue or match id from a real sample").isEmpty();
    }

    // ---- what is scanned ----

    /** The docs, besides spec 108 and its plan, that this feature changed. */
    private static final List<String> CHANGED_DOCS = List.of("docs/roadmap.md", "docs/architecture.md",
            "docs/standards/backend.md", "docs/specs/104-match-results-import-adaptors.md", "CLAUDE.md");

    /** Every test source and resource, the STUMPS adaptor's sources, spec 108 and its plan, and the docs it changed. */
    private static List<Path> filesToCheck(Path root) throws IOException {
        List<Path> files = new ArrayList<>();
        Path backend = Path.of(System.getProperty("user.dir"));
        try (Stream<Path> walk = Files.walk(backend.resolve("src/test"))) {
            walk.filter(Files::isRegularFile).filter(StumpsSamplePrivacyTest::isText).forEach(files::add);
        }
        try (Stream<Path> walk = Files.walk(backend.resolve("src/main/java"))) {
            walk.filter(Files::isRegularFile).filter(p -> p.getFileName().toString().startsWith("Stumps"))
                    .filter(p -> p.getFileName().toString().endsWith(".java")).forEach(files::add);
        }
        for (String dir : List.of("docs/specs", "docs/plans")) {
            try (Stream<Path> walk = Files.list(root.resolve(dir))) {
                walk.filter(p -> p.getFileName().toString().startsWith("108") || (dir.equals("docs/specs")
                        && p.getFileName().toString().startsWith("107"))).forEach(files::add);
            }
        }
        for (String doc : CHANGED_DOCS) {
            if (Files.isRegularFile(root.resolve(doc))) {
                files.add(root.resolve(doc));
            }
        }
        return files;
    }

    /** The files whose text is compared with the names: all but the older tests, which are compared by match id only. */
    private static boolean isOwned(Path file) {
        String path = file.toString().replace('\\', '/');
        boolean olderTest = path.contains("/src/test/") && !file.getFileName().toString().startsWith("Stumps")
                && !path.contains("/stumps/");
        return !olderTest;
    }

    private static boolean isText(Path file) {
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        return List.of(".java", ".xml", ".json", ".csv", ".txt", ".md", ".yaml", ".yml", ".properties", ".sql")
                .stream().anyMatch(name::endsWith);
    }

    /** The repository root, found by walking up from the working directory to the folder that has {@code docs}. */
    private static Path repositoryRoot() {
        Path dir = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        while (dir != null) {
            if (Files.isDirectory(dir.resolve("docs/specs"))) {
                return dir;
            }
            dir = dir.getParent();
        }
        return null;
    }

    private static String readLenient(Path file) {
        try {
            return new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    // ---- matching ----

    /** True when any name occurs in the text as a whole word or phrase, ignoring case and runs of white space. */
    private static boolean mentions(String text, Set<String> names) {
        String flat = fold(text).replaceAll("\\s+", " ");
        for (String name : names) {
            Matcher match = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(fold(name)) + "(?![\\p{L}\\p{N}])").matcher(flat);
            if (match.find()) {
                return true;
            }
        }
        return false;
    }

    /** Lower case, decomposed (NFD) with the accents stripped, so an accented and an unaccented spelling compare equal. */
    private static String fold(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
    }

    // ---- harvesting the names of a real sample ----

    private static String pdfText(Path pdf) {
        try (PDDocument document = Loader.loadPDF(Files.readAllBytes(pdf))) {
            return new PDFTextStripper().getText(document);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    /** The lower case match ids of a STUMPS report's text. */
    static Set<String> stumpsMatchIds(String text) {
        Set<String> ids = new TreeSet<>();
        text.lines().map(l -> l.trim()).forEach(line -> {
            Matcher id = Pattern.compile("^Match ID (\\S+)$").matcher(line);
            if (id.matches()) {
                ids.add(id.group(1).toLowerCase(Locale.ROOT));
            }
        });
        return ids;
    }

    /** Lower case names, teams, venues, organisers, scorers and match ids of a STUMPS report's text. */
    static Set<String> stumpsNames(String text) {
        List<String> lines = text.lines().map(l -> l.replaceAll("\\s+", " ").trim()).filter(l -> !l.isEmpty()).toList();
        Set<String> names = new TreeSet<>();
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            if (FIGURES.matcher(line).matches()) {
                batterRow(names, lines, i);
            }
            if (SCORE_LINE.matcher(line).matches() && i >= 1) {
                add(names, lines.get(i - 1), false);
            }
            Matcher labelled = LABELLED.matcher(line);
            if (labelled.matches()) {
                add(names, labelled.group(2), false);
            }
            if (line.startsWith("Toss ") && line.contains(" To ")) {
                add(names, line.substring(5, line.lastIndexOf(" To ")).replaceFirst(" \\S+$", ""), false);
            }
            if (line.contains(" won by ")) {
                add(names, line.substring(0, line.indexOf(" won by ")), false);
            }
            if (line.equals("Player Of The Match")) {
                StringBuilder winner = new StringBuilder();
                for (int j = i + 1; j < lines.size() && j <= i + 4 && !lines.get(j).equals("Match Information"); j++) {
                    winner.append(' ').append(lines.get(j));
                }
                add(names, winner.toString(), true);
            }
            if (line.equals("Fall Of Wickets")) {
                StringBuilder fall = new StringBuilder();
                for (int j = i + 1; j < lines.size() && j <= i + 12 && !BOWLING_HEADER.matcher(lines.get(j)).matches(); j++) {
                    fall.append(' ').append(lines.get(j));
                }
                fallOfWickets(names, fall.toString());
            }
            dismissalNames(names, line);
            fallOfWickets(names, line);
            Matcher performer = TOP_PERFORMER.matcher(line);
            while (performer.find()) {
                add(names, performer.group(1), true);
                add(names, performer.group(2), true);
            }
            Matcher ball = BALL_BY_BALL_BATTER.matcher(line);
            if (ball.matches()) {
                add(names, ball.group(1), true);
            }
            String[] tokens = line.split(" ");
            if (tokens.length >= 11 && lastTenNumeric(tokens)) {
                add(names, String.join(" ", java.util.Arrays.copyOfRange(tokens, 0, tokens.length - 10)), true);
            }
        }
        return names;
    }

    /**
     * The batter of the figures line at {@code figures}: every line back to the previous figures line, the 'Extras' line or
     * the card's column header (at most eight) is the name and the dismissal, so a name or a dismissal that wraps over
     * several lines is taken whole, and each of its lines on its own too.
     */
    private static void batterRow(Set<String> names, List<String> lines, int figures) {
        int from = figures;
        while (from > 0 && figures - from < 8) {
            String previous = lines.get(from - 1);
            if (FIGURES.matcher(previous).matches() || previous.equals("Extras") || CARD_COLUMNS.matcher(previous).matches()
                    || previous.endsWith("Innings Scorecard")) {
                break;
            }
            from--;
        }
        List<String> group = lines.subList(from, figures);
        if (group.isEmpty()) {
            return;
        }
        int dismissal = group.size() - 1;
        for (int k = 1; k < group.size(); k++) {
            if (DISMISSAL_START.matcher(group.get(k)).matches()) {
                dismissal = k;
                break;
            }
        }
        add(names, String.join(" ", group.subList(0, dismissal)), true);
        if (dismissal > 1) {
            group.subList(0, dismissal).forEach(part -> add(names, part, true));
        }
        String wording = String.join(" ", group.subList(dismissal, group.size()));
        dismissalNames(names, wording);
        for (String part : group.subList(dismissal, group.size())) {
            dismissalNames(names, part);
        }
    }

    private static void fallOfWickets(Set<String> names, String text) {
        Matcher fall = FALL_OF_WICKET.matcher(text);
        while (fall.find()) {
            add(names, fall.group(1), true);
        }
    }

    private static void dismissalNames(Set<String> names, String line) {
        Matcher dismissal = DISMISSAL_NAMES.matcher(line);
        if (dismissal.matches()) {
            String inner = dismissal.group(1).replace("(", " ").replace(")", " ").replace("/", " b ").replace(",", " b ");
            for (String part : inner.split(" b | c ")) {
                add(names, part, true);
            }
        }
    }

    private static boolean lastTenNumeric(String[] tokens) {
        for (int i = tokens.length - 10; i < tokens.length; i++) {
            if (!NUMERIC.matcher(tokens[i]).matches()) {
                return false;
            }
        }
        return true;
    }

    /** The names, teams and venue words of a CricClubs export: every cell that is not a column title or a figure. */
    static Set<String> cricClubsNames(byte[] bytes) {
        String text = new String(bytes, Charset.forName("windows-1252"));
        Set<String> names = new TreeSet<>();
        for (String raw : text.split("\r\n|\n|\r")) {
            String line = raw.trim();
            if (line.contains(":") || line.toLowerCase(Locale.ROOT).contains("fall of wickets")) {
                // the result line and the extras line; the teams are taken from the teams line
                Matcher result = Pattern.compile("^[^:]+:\\s*(.*?)\\s+won by", Pattern.CASE_INSENSITIVE).matcher(line);
                if (result.find()) {
                    add(names, result.group(1), false);
                }
                continue;
            }
            for (String part : line.split("\\s+Vs\\s+")) {
                for (String cell : part.split(",")) {
                    String value = cell.trim();
                    String lower = value.toLowerCase(Locale.ROOT);
                    boolean titled = lower.endsWith(" batting") || lower.endsWith(" bowling") || lower.startsWith("over");
                    boolean figure = lower.matches("^\\d[\\d\\-./]*[a-z]*$");
                    if (!CSV_STRUCTURE.contains(lower) && !titled && !figure && value.chars().anyMatch(Character::isLetter)) {
                        add(names, value, false);
                    }
                }
            }
        }
        return names;
    }

    /**
     * Keeps a candidate that is a phrase of two or more words, or one word of four or more letters (two or more when it
     * is in a name position: a batter, bowler, fielder or player of the match). Accents are stripped and the case folded.
     * A candidate made only of structural words and numbers (a marker row, a placeholder) is not a name.
     */
    private static void add(Set<String> names, String candidate, boolean namePosition) {
        if (candidate == null) {
            return;
        }
        String value = fold(candidate).replaceAll("\\s+", " ").trim();
        boolean phrase = value.contains(" ");
        boolean structure = value.equals("-") || java.util.Arrays.stream(value.split(" "))
                .allMatch(word -> STRUCTURE_WORDS.contains(word) || word.matches("[\\d.*()\\-]+"));
        int shortest = namePosition ? 2 : 4;
        if ((phrase || value.length() >= shortest) && value.chars().anyMatch(Character::isLetterOrDigit) && !structure) {
            names.add(value);
        }
    }
}
