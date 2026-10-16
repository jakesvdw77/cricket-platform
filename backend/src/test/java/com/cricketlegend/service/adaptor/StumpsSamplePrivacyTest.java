package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
    void nameHarvestingReadsEveryPlaceAReportPutsAName() {
        String report = String.join("\n",
                "Team Zeta Alphas", "10-1 in 2.0 overs",
                "Venue Quillfeather Oval", "Match ID zz99aa00",
                "Zed Quillfeather", "c Marlowe Vance b Idris Okonkwo", "1 2 0 0 50.0",
                "Idris Okonkwo 4.0 0 22 3 5.5 14 2 0 2 0",
                "10-1 (Zed Quillfeather, 4.2)");

        Set<String> names = stumpsNames(report);

        assertThat(names).contains("team zeta alphas", "quillfeather oval", "zz99aa00", "zed quillfeather",
                "marlowe vance", "idris okonkwo");
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

    /** Every test source and resource, spec 108 and its plan. */
    private static List<Path> filesToCheck(Path root) throws IOException {
        List<Path> files = new ArrayList<>();
        Path tests = Path.of(System.getProperty("user.dir")).resolve("src/test");
        try (Stream<Path> walk = Files.walk(tests)) {
            walk.filter(Files::isRegularFile).filter(StumpsSamplePrivacyTest::isText).forEach(files::add);
        }
        for (String dir : List.of("docs/specs", "docs/plans")) {
            try (Stream<Path> walk = Files.list(root.resolve(dir))) {
                walk.filter(p -> p.getFileName().toString().startsWith("108")).forEach(files::add);
            }
        }
        return files;
    }

    /** The files this feature owns: its tests and fixtures (named {@code Stumps*} or under a {@code stumps} folder), spec and plan. */
    private static boolean isOwned(Path file) {
        String path = file.toString().replace('\\', '/');
        return file.getFileName().toString().startsWith("Stumps") || path.contains("/stumps/")
                || file.getFileName().toString().startsWith("108");
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
        String flat = text.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        for (String name : names) {
            Matcher match = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(name) + "(?![\\p{L}\\p{N}])").matcher(flat);
            if (match.find()) {
                return true;
            }
        }
        return false;
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
            if (FIGURES.matcher(line).matches() && i >= 2) {
                add(names, lines.get(i - 2));
                dismissalNames(names, lines.get(i - 1));
            }
            if (SCORE_LINE.matcher(line).matches() && i >= 1) {
                add(names, lines.get(i - 1));
            }
            Matcher labelled = LABELLED.matcher(line);
            if (labelled.matches()) {
                add(names, labelled.group(2));
            }
            if (line.startsWith("Toss ") && line.contains(" To ")) {
                add(names, line.substring(5, line.lastIndexOf(" To ")).replaceFirst(" \\S+$", ""));
            }
            if (line.contains(" won by ")) {
                add(names, line.substring(0, line.indexOf(" won by ")));
            }
            dismissalNames(names, line);
            Matcher fall = FALL_OF_WICKET.matcher(line);
            while (fall.find()) {
                add(names, fall.group(1));
            }
            Matcher performer = TOP_PERFORMER.matcher(line);
            while (performer.find()) {
                add(names, performer.group(1));
                add(names, performer.group(2));
            }
            Matcher ball = BALL_BY_BALL_BATTER.matcher(line);
            if (ball.matches()) {
                add(names, ball.group(1));
            }
            String[] tokens = line.split(" ");
            if (tokens.length >= 11 && lastTenNumeric(tokens)) {
                add(names, String.join(" ", java.util.Arrays.copyOfRange(tokens, 0, tokens.length - 10)));
            }
        }
        return names;
    }

    private static void dismissalNames(Set<String> names, String line) {
        Matcher dismissal = DISMISSAL_NAMES.matcher(line);
        if (dismissal.matches()) {
            for (String part : dismissal.group(1).replace("(", " ").replace(")", " ").split(" b | c ")) {
                add(names, part);
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
                    add(names, result.group(1));
                }
                continue;
            }
            for (String part : line.split("\\s+Vs\\s+")) {
                for (String cell : part.split(",")) {
                    String value = cell.trim();
                    String lower = value.toLowerCase(Locale.ROOT);
                    boolean titled = lower.endsWith(" batting") || lower.endsWith(" bowling") || lower.startsWith("over");
                    if (!CSV_STRUCTURE.contains(lower) && !titled && value.chars().anyMatch(Character::isLetter)) {
                        add(names, value);
                    }
                }
            }
        }
        return names;
    }

    /** Keeps a candidate that is a phrase of two or more words, or one word of four or more letters. */
    private static void add(Set<String> names, String candidate) {
        if (candidate == null) {
            return;
        }
        String value = candidate.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        boolean phrase = value.contains(" ");
        boolean structure = value.equals("-") || value.equals("stumps");
        if ((phrase || value.length() >= 4) && value.chars().anyMatch(Character::isLetterOrDigit) && !structure) {
            names.add(value);
        }
    }
}
