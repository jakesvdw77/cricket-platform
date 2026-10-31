package com.cricketlegend.service.support.schedule;

import com.cricketlegend.service.support.NameAliases;
import com.cricketlegend.service.support.PlayerNameMatcher;
import com.cricketlegend.service.support.TeamNameForms;
import com.cricketlegend.service.support.schedule.TeamNameSynonyms.Segment;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Ranked link proposals for a team name written in a league schedule file (docs/specs/098-league-schedule-import.md,
 * "Team resolution"). Deterministic, no AI and no database: the caller loads the candidate lists once per preview and
 * passes them in. Names are never logged. The rules, in order: remembered aliases first; identical normalised names
 * (100); synonyms and abbreviations (95); same letters with different spacing (94); acronyms (92); one or two letters
 * different (88 or 84); token similarity (below 90). The numeric suffix rule is hard: names with different team numbers
 * are never proposed as the same team, only as a sister-team hint without a Link action. Only an exact candidate (100)
 * or a remembered alias is ever preselected.
 */
@Component
public class TeamNameMatcher {

    /** Where a candidate lives, in the spec's search order (also the tie-break order). */
    public enum CandidateSource {
        ALIAS, OWN_AFFILIATED, LEAGUE_THIS_SEASON, LEAGUE_PREVIOUS_SEASON, LEAGUE_OTHER, OWN_OTHER
    }

    public enum ConfidenceBand {
        EXACT, HIGH, MEDIUM, LOW;

        public static ConfidenceBand of(int confidence) {
            if (confidence >= 100) {
                return EXACT;
            }
            if (confidence >= 90) {
                return HIGH;
            }
            return confidence >= 70 ? MEDIUM : LOW;
        }
    }

    /**
     * A team the name could link to. {@code targetKind} is {@code OWN_TEAM} or {@code LEAGUE_TEAM} (a league team of
     * another season or league means "copy"; the caller knows from {@code source}). {@code createdByImport} marks a
     * league team an earlier import created.
     */
    public record TeamCandidate(
            CandidateSource source,
            String targetKind,
            UUID targetId,
            String name,
            String abbreviation,
            String seasonLabel,
            String leagueName,
            boolean active,
            boolean createdByImport) {}

    /** A remembered alias already resolved by the caller to a concrete candidate; {@code rememberedOn} is display text. */
    public record RememberedAlias(String aliasNormalised, TeamCandidate target, String rememberedOn) {}

    /**
     * One ranked proposal. {@code linkable} is false for the sister-team hint (no Link action). {@code preselected} is
     * true only for an exact candidate or a remembered alias.
     */
    public record TeamProposal(
            CandidateSource source,
            String targetKind,
            UUID targetId,
            String targetName,
            String abbreviation,
            String seasonLabel,
            String leagueName,
            boolean active,
            int confidence,
            ConfidenceBand band,
            List<String> reasons,
            boolean preselected,
            boolean linkable) {}

    static final int MIN_CONFIDENCE = 45;
    static final int MAX_PROPOSALS = 10;
    static final int MAX_SISTERS = 3;
    private static final Set<String> STOP_WORDS = Set.of("OF", "THE", "AND");
    private static final Pattern NUMBER_TOKEN = Pattern.compile("^(\\d+)(?:ST|ND|RD|TH)?$");
    private static final Pattern AGE_TOKEN = Pattern.compile("^U\\d{1,2}$");

    // ---------------------------------------------------------------------------------------------------------------
    // Public entry points
    // ---------------------------------------------------------------------------------------------------------------

    /** Ranked proposals for one written name. */
    public List<TeamProposal> propose(
            String sheetName, List<TeamCandidate> candidates, List<RememberedAlias> aliases) {
        return proposeAll(List.of(sheetName), candidates, aliases).get(sheetName);
    }

    /** Ranked proposals per distinct written name (keys keep the given text), forms of the candidates built once. */
    public Map<String, List<TeamProposal>> proposeAll(
            Collection<String> sheetNames, List<TeamCandidate> candidates, List<RememberedAlias> aliases) {
        List<Form> forms = new ArrayList<>(candidates.size());
        for (TeamCandidate candidate : candidates) {
            forms.add(Form.of(candidate.name()));
        }
        Map<String, List<TeamProposal>> out = new LinkedHashMap<>();
        for (String name : sheetNames) {
            out.put(name, rank(name, candidates, forms, aliases));
        }
        return out;
    }

    private List<TeamProposal> rank(String sheetName, List<TeamCandidate> candidates, List<Form> forms,
            List<RememberedAlias> aliases) {
        Form sheet = Form.of(sheetName);
        String key = NameAliases.normalise(sheetName);
        List<TeamProposal> proposals = new ArrayList<>();
        Set<String> taken = new HashSet<>();
        for (RememberedAlias alias : aliases) {
            if (alias.aliasNormalised() != null && alias.aliasNormalised().equals(key)) {
                TeamCandidate t = alias.target();
                taken.add(t.targetKind() + "|" + t.targetId());
                List<String> reasons = new ArrayList<>();
                reasons.add("remembered from an import" + (alias.rememberedOn() == null ? "" : " on " + alias.rememberedOn()));
                proposals.add(new TeamProposal(CandidateSource.ALIAS, t.targetKind(), t.targetId(), t.name(),
                        t.abbreviation(), t.seasonLabel(), t.leagueName(), t.active(), 100, ConfidenceBand.EXACT,
                        reasons, t.active(), true));
            }
        }
        long aliasCount = proposals.size();
        List<TeamProposal> sisters = new ArrayList<>();
        for (int i = 0; i < candidates.size(); i++) {
            TeamCandidate c = candidates.get(i);
            if (taken.contains(c.targetKind() + "|" + c.targetId())) {
                continue;
            }
            Scored scored = score(sheet, forms.get(i));
            if (scored == null) {
                continue;
            }
            List<String> reasons = new ArrayList<>(scored.reasons());
            if (scored.sister()) {
                sisters.add(new TeamProposal(c.source(), c.targetKind(), c.targetId(), c.name(), c.abbreviation(),
                        c.seasonLabel(), c.leagueName(), c.active(), 0, ConfidenceBand.LOW, reasons, false, false));
                continue;
            }
            if (scored.confidence() == 100 && c.createdByImport()) {
                reasons.add("created by an earlier import");
            }
            if (scored.confidence() >= 90 && c.source() == CandidateSource.LEAGUE_PREVIOUS_SEASON) {
                reasons.add("same team name last season");
            }
            if (!c.active()) {
                reasons.add("inactive");
            }
            proposals.add(new TeamProposal(c.source(), c.targetKind(), c.targetId(), c.name(), c.abbreviation(),
                    c.seasonLabel(), c.leagueName(), c.active(), scored.confidence(),
                    ConfidenceBand.of(scored.confidence()), reasons, false, true));
        }
        Comparator<TeamProposal> order = Comparator
                .comparingInt((TeamProposal p) -> p.source() == CandidateSource.ALIAS ? 0 : 1)
                .thenComparing(Comparator.comparingInt(TeamProposal::confidence).reversed())
                .thenComparingInt(p -> p.source().ordinal())
                .thenComparing(p -> p.targetName().toLowerCase(Locale.ROOT));
        proposals.sort(order);
        if (proposals.size() > MAX_PROPOSALS) {
            proposals = new ArrayList<>(proposals.subList(0, MAX_PROPOSALS));
        }
        sisters.sort(Comparator.comparingInt((TeamProposal p) -> p.source().ordinal())
                .thenComparing(p -> p.targetName().toLowerCase(Locale.ROOT)));
        List<TeamProposal> result = new ArrayList<>(preselect(proposals, aliasCount));
        result.addAll(sisters.size() > MAX_SISTERS ? sisters.subList(0, MAX_SISTERS) : sisters);
        return List.copyOf(result);
    }

    /** Aliases win and are the only preselection; otherwise one unambiguous exact candidate (none when two tie). */
    private static List<TeamProposal> preselect(List<TeamProposal> sorted, long aliasCount) {
        List<TeamProposal> out = new ArrayList<>(sorted.size());
        int selected = -1;
        if (aliasCount == 1) {
            selected = 0;
        } else if (aliasCount == 0) {
            for (int i = 0; i < sorted.size(); i++) {
                TeamProposal p = sorted.get(i);
                if (p.confidence() == 100 && p.linkable() && p.active()) {
                    long sameSourceExact = sorted.stream()
                            .filter(o -> o.confidence() == 100 && o.source() == p.source()).count();
                    selected = sameSourceExact == 1 ? i : -1;
                    break;
                }
            }
        }
        for (int i = 0; i < sorted.size(); i++) {
            TeamProposal p = sorted.get(i);
            boolean on = i == selected && p.active();
            out.add(new TeamProposal(p.source(), p.targetKind(), p.targetId(), p.targetName(), p.abbreviation(),
                    p.seasonLabel(), p.leagueName(), p.active(), p.confidence(), p.band(), p.reasons(), on, p.linkable()));
        }
        return out;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Static helpers shared with the validator and the identity rules
    // ---------------------------------------------------------------------------------------------------------------

    /** Upper case words, accents removed, "&amp;" as AND, punctuation dropped, whitespace collapsed. */
    public static String normalise(String name) {
        return String.join(" ", Form.words(name));
    }

    /** The name without its team number or letter, normalised. */
    public static String baseName(String name) {
        return String.join(" ", Form.of(name).base());
    }

    /** The team number or letter of the name ("1" for "Police 1st"), or null. */
    public static String suffixOf(String name) {
        Suffix suffix = Form.of(name).suffix();
        return suffix == null ? null : suffix.value();
    }

    /** True when the names are two teams of one club: the same base name and different team numbers or letters. */
    public static boolean sisterTeams(String a, String b) {
        Form fa = Form.of(a);
        Form fb = Form.of(b);
        return fa.suffix() != null && fb.suffix() != null && !fa.suffix().equals(fb.suffix())
                && !fa.expanded().isEmpty() && fa.expanded().equals(fb.expanded());
    }

    /** True when the two names would be proposed at medium confidence or better (never across team numbers). */
    public static boolean similar(String a, String b) {
        Scored scored = score(Form.of(a), Form.of(b));
        return scored != null && !scored.sister() && scored.confidence() >= 70;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Scoring
    // ---------------------------------------------------------------------------------------------------------------

    record Scored(int confidence, List<String> reasons, boolean sister) {}

    private record Base(int score, List<String> reasons) {}

    private enum SuffixKind { NUMBER, LETTER }

    private record Suffix(SuffixKind kind, String value) {}

    private record Form(
            String raw,
            List<String> base,
            Suffix suffix,
            int suffixWords,
            List<String> age,
            List<Segment> segments,
            List<String> expanded,
            String acronym) {

        static List<String> words(String name) {
            if (name == null) {
                return List.of();
            }
            return TeamNameForms.words(name.replace("&", " and ")).stream()
                    .map(w -> w.toUpperCase(Locale.ROOT)).toList();
        }

        static Form of(String name) {
            List<String> all = words(name);
            List<String> age = new ArrayList<>();
            List<String> core = new ArrayList<>();
            for (String w : all) {
                if (AGE_TOKEN.matcher(w).matches()) {
                    age.add(w);
                } else {
                    core.add(w);
                }
            }
            Suffix suffix = null;
            int suffixWords = 0;
            if (core.size() >= 3 && "XI".equals(core.get(core.size() - 1))
                    && NUMBER_TOKEN.matcher(core.get(core.size() - 2)).matches()) {
                core.remove(core.size() - 1);
                suffixWords = 1;
            }
            if (core.size() >= 2) {
                String last = core.get(core.size() - 1);
                var number = NUMBER_TOKEN.matcher(last);
                if (number.matches()) {
                    suffix = new Suffix(SuffixKind.NUMBER, number.group(1).replaceFirst("^0+(?=\\d)", ""));
                } else if ("A".equals(last) || "B".equals(last)) {
                    suffix = new Suffix(SuffixKind.LETTER, last);
                }
                if (suffix != null) {
                    core.remove(core.size() - 1);
                    suffixWords++;
                }
            }
            List<Segment> segments = TeamNameSynonyms.expand(core);
            List<String> expanded = TeamNameSynonyms.canonicalWords(segments);
            String acronym = null;
            if (core.size() == 1 && core.get(0).matches("[A-Z]{3,8}") && rawCapitals(name).contains(core.get(0))) {
                acronym = core.get(0);
            }
            return new Form(name == null ? "" : name.trim(), List.copyOf(core), suffix, suffixWords, List.copyOf(age),
                    segments, expanded, acronym);
        }

        /** The written tokens that are entirely capital letters (case matters for the acronym rule). */
        private static Set<String> rawCapitals(String name) {
            Set<String> out = new HashSet<>();
            if (name == null) {
                return out;
            }
            String plain = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                    .replaceAll("[.'’`‘]", "");
            for (String token : plain.split("[^\\p{L}\\p{N}]+")) {
                if (!token.isEmpty() && token.equals(token.toUpperCase(Locale.ROOT))) {
                    out.add(token);
                }
            }
            return out;
        }

        /** The written name without its suffix words, for display in a reason. */
        String displayBase() {
            String[] parts = raw.split("\\s+");
            int keep = parts.length - suffixWords;
            return keep >= 1 && suffixWords > 0 ? String.join(" ", List.of(parts).subList(0, keep)) : raw;
        }
    }

    private static Scored score(Form sheet, Form candidate) {
        boolean ageMissingInSheet = false;
        boolean ageMissingInTeam = false;
        if (!sheet.age().equals(candidate.age())) {
            if (!sheet.age().isEmpty() && !candidate.age().isEmpty()) {
                return null;
            }
            ageMissingInSheet = sheet.age().isEmpty();
            ageMissingInTeam = !ageMissingInSheet;
        }
        Base base = baseScore(sheet, candidate);
        if (base == null) {
            return null;
        }
        if (ageMissingInSheet) {
            // The sheet names an open (senior) side and the team is an age-group side of the same club ("Irene Villagers 1" and
            // "Irene Villagers U15"): different teams, never proposed as the same one, like a different team number.
            return base.score() >= 90
                    ? new Scored(0, List.of("sister team: same club name, but this team is an age-group side"), true)
                    : null;
        }
        if (sheet.suffix() != null && candidate.suffix() != null && !sheet.suffix().equals(candidate.suffix())) {
            return base.score() >= 90
                    ? new Scored(0, List.of("sister team: same club name, different team number"), true)
                    : null;
        }
        int confidence = base.score();
        List<String> reasons = new ArrayList<>(base.reasons());
        if (sheet.suffix() == null && candidate.suffix() != null) {
            confidence = Math.min(confidence, 80);
            reasons.add(candidate.suffix().kind() == SuffixKind.NUMBER
                    ? "no team number in the sheet" : "no team letter in the sheet");
        } else if (sheet.suffix() != null && candidate.suffix() == null) {
            confidence = Math.min(confidence, 75);
            reasons.add("the sheet has a team number the team does not have");
        }
        if (ageMissingInTeam) {
            confidence = Math.min(confidence, 75);
            reasons.add("the sheet has an age group the team does not have");
        }
        return confidence < MIN_CONFIDENCE ? null : new Scored(confidence, reasons, false);
    }

    private static Base baseScore(Form s, Form c) {
        if (s.base().isEmpty() || c.base().isEmpty()) {
            return null;
        }
        if (s.base().equals(c.base())) {
            return new Base(100, List.of("same name"));
        }
        if (s.expanded().equals(c.expanded())) {
            return new Base(95, synonymReasons(s, c));
        }
        String joinedS = String.join("", s.expanded());
        String joinedC = String.join("", c.expanded());
        if (joinedS.equals(joinedC)) {
            return new Base(94, List.of("same letters, different spacing"));
        }
        if (s.acronym() != null && initials(c).contains(s.acronym())) {
            return new Base(92, List.of(s.acronym() + " = initials of " + c.displayBase()));
        }
        if (c.acronym() != null && initials(s).contains(c.acronym())) {
            return new Base(92, List.of(c.acronym() + " = initials of " + s.displayBase()));
        }
        String embedded = embeddedAcronym(s, c);
        if (embedded == null) {
            embedded = embeddedAcronym(c, s);
        }
        if (embedded != null) {
            return new Base(92, List.of(embedded));
        }
        return fuzzy(s, c, joinedS, joinedC);
    }

    /**
     * An acronym token inside a multi-word name (spec 098 rule 3): {@code PHSOB VETERANS} against {@code Pretoria High
     * School Old Boys Veterans}. The words around the capital-letter token must equal the full name's words around a run
     * of words whose initials are the token. Returns the reason, or null. The team number is judged by the caller.
     */
    private static String embeddedAcronym(Form written, Form full) {
        List<String> w = written.base();
        List<String> f = full.base();
        if (w.size() < 2 || f.size() <= w.size()) {
            return null;
        }
        Set<String> capitals = Form.rawCapitals(written.raw());
        for (int i = 0; i < w.size(); i++) {
            String token = w.get(i);
            if (!token.matches("[A-Z]{3,8}") || !capitals.contains(token)) {
                continue;
            }
            List<String> before = w.subList(0, i);
            List<String> after = w.subList(i + 1, w.size());
            int midEnd = f.size() - after.size();
            if (midEnd <= before.size() || !f.subList(0, before.size()).equals(before)
                    || !f.subList(midEnd, f.size()).equals(after)) {
                continue;
            }
            List<String> middle = f.subList(before.size(), midEnd);
            if (token.equals(initialsOf(middle))) {
                return token + " = initials of " + String.join(" ", middle) + " (in " + written.displayBase() + ")";
            }
        }
        return null;
    }

    private static List<String> synonymReasons(Form s, Form c) {
        Map<String, String> candidateOriginals = new LinkedHashMap<>();
        for (Segment segment : c.segments()) {
            candidateOriginals.put(segment.canonical(), segment.original());
        }
        Set<String> reasons = new LinkedHashSet<>();
        for (Segment segment : s.segments()) {
            String other = candidateOriginals.get(segment.canonical());
            if (other != null && !other.equals(segment.original())) {
                reasons.add(segment.original() + " = " + other);
            }
        }
        return reasons.isEmpty() ? List.of("same name") : List.copyOf(reasons);
    }

    /** Initials of the significant words, as written, expanded, and without a trailing "CRICKET CLUB". */
    private static Set<String> initials(Form f) {
        Set<String> out = new HashSet<>();
        out.add(initialsOf(f.base()));
        out.add(initialsOf(f.expanded()));
        List<String> e = f.expanded();
        if (e.size() > 2 && "CRICKET".equals(e.get(e.size() - 2)) && "CLUB".equals(e.get(e.size() - 1))) {
            out.add(initialsOf(e.subList(0, e.size() - 2)));
        }
        out.removeIf(String::isEmpty);
        return out;
    }

    private static String initialsOf(List<String> words) {
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!STOP_WORDS.contains(w) && !w.isEmpty()) {
                sb.append(w.charAt(0));
            }
        }
        return sb.length() >= 3 ? sb.toString() : "";
    }

    private static Base fuzzy(Form s, Form c, String joinedS, String joinedC) {
        int best = 0;
        List<String> reasons = new ArrayList<>();
        int shorter = Math.min(joinedS.length(), joinedC.length());
        if (shorter >= 5) {
            int allowed = shorter >= 10 ? 2 : 1;
            int distance = PlayerNameMatcher.editDistance(joinedS, joinedC, allowed);
            if (distance >= 1 && distance <= allowed) {
                best = distance == 1 ? 88 : 84;
                reasons = new ArrayList<>(List.of(distance == 1 ? "one letter different" : "two letters different"));
            }
        }
        List<String> a = significant(s.expanded());
        List<String> b = significant(c.expanded());
        if (!a.isEmpty() && !b.isEmpty()) {
            boolean[] used = new boolean[b.size()];
            double shared = 0;
            int typos = 0;
            List<String> sharedWords = new ArrayList<>();
            for (String token : a) {
                int idx = indexOfUnused(b, used, token, false);
                if (idx >= 0) {
                    used[idx] = true;
                    shared += 1;
                    sharedWords.add(token);
                    continue;
                }
                idx = indexOfUnused(b, used, token, true);
                if (idx >= 0) {
                    used[idx] = true;
                    shared += 0.9;
                    typos++;
                }
            }
            double jaccard = shared / (a.size() + b.size() - shared);
            int score = (int) Math.round(30 + 50 * jaccard);
            List<String> why = new ArrayList<>();
            if (!sharedWords.isEmpty()) {
                why.add("shares " + String.join(", ", sharedWords));
            }
            if (typos > 0) {
                why.add("a word is spelled slightly differently");
            }
            List<String> shortList = a.size() <= b.size() ? a : b;
            List<String> longList = a.size() <= b.size() ? b : a;
            if (shortList.size() >= 2 && new HashSet<>(longList).containsAll(shortList)) {
                score = Math.max(score, 78);
                why = new ArrayList<>(List.of("every word of the shorter name is in the longer one"));
            }
            score = Math.min(score, 89);
            if (jaccard >= 0.34 && score > best) {
                best = score;
                reasons = why.isEmpty() ? new ArrayList<>(List.of("similar words")) : why;
            }
        }
        return best >= MIN_CONFIDENCE ? new Base(best, reasons) : null;
    }

    private static List<String> significant(List<String> words) {
        return words.stream().filter(w -> !STOP_WORDS.contains(w)).toList();
    }

    private static int indexOfUnused(List<String> words, boolean[] used, String token, boolean fuzzy) {
        for (int i = 0; i < words.size(); i++) {
            if (used[i]) {
                continue;
            }
            String other = words.get(i);
            boolean hit = fuzzy
                    ? token.length() >= 5 && other.length() >= 5 && PlayerNameMatcher.withinTolerance(token, other)
                    : token.equals(other);
            if (hit) {
                return i;
            }
        }
        return -1;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Tidy name for a team to be created
    // ---------------------------------------------------------------------------------------------------------------

    private static final Set<String> ROMAN = Set.of("XI", "II", "III", "IV");
    private static final Set<String> COMMON_ONSETS = Set.of("STR", "SCR", "SPR", "SPL", "SCH", "SHR", "THR", "CHR");
    private static final Pattern ORDINAL = Pattern.compile("^\\d+(?:st|nd|rd|th)$", Pattern.CASE_INSENSITIVE);

    /**
     * The suggested name for a team to be created: title case, except short or vowel-less all-capital tokens and
     * tokens that look like initials ({@code PHSOB}, {@code CBCOB}), which stay as typed; numerals and ordinals are
     * kept. A heuristic only: the user edits it before confirming.
     */
    public static String tidyTeamName(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }
        String[] parts = name.trim().split("\\s+");
        List<String> out = new ArrayList<>(parts.length);
        for (int i = 0; i < parts.length; i++) {
            String[] pieces = parts[i].split("-", -1);
            List<String> tidy = new ArrayList<>(pieces.length);
            for (String piece : pieces) {
                tidy.add(tidyToken(piece, i == 0));
            }
            out.add(String.join("-", tidy));
        }
        return String.join(" ", out);
    }

    private static String tidyToken(String token, boolean first) {
        if (token.isEmpty() || "&".equals(token)) {
            return token;
        }
        if (ORDINAL.matcher(token).matches()) {
            return token.toLowerCase(Locale.ROOT);
        }
        boolean hasDigit = token.chars().anyMatch(Character::isDigit);
        boolean hasLower = token.chars().anyMatch(Character::isLowerCase);
        boolean hasUpper = token.chars().anyMatch(Character::isUpperCase);
        if (hasDigit || (hasLower && hasUpper)) {
            return token;
        }
        if (hasLower) {
            return capitalise(token);
        }
        // All capitals from here on.
        String lower = token.toLowerCase(Locale.ROOT);
        if (!first && STOP_WORDS.contains(token)) {
            return lower;
        }
        if (ROMAN.contains(token) || staysAsTyped(token)) {
            return token;
        }
        if (token.matches("[A-Z]'[A-Z]+")) {
            return token.charAt(0) + "'" + capitalise(lower.substring(2));
        }
        return capitalise(lower);
    }

    private static String capitalise(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static boolean staysAsTyped(String token) {
        if (!token.chars().allMatch(Character::isLetter)) {
            return false;
        }
        if (token.length() <= 2) {
            return true;
        }
        long vowels = token.chars().filter(ch -> "AEIOUY".indexOf(ch) >= 0).count();
        if (vowels == 0) {
            return true;
        }
        if (token.length() > 8) {
            return false;
        }
        long strictVowels = token.chars().filter(ch -> "AEIOU".indexOf(ch) >= 0).count();
        boolean threeConsonants = token.length() >= 3
                && token.substring(0, 3).chars().noneMatch(ch -> "AEIOUY".indexOf(ch) >= 0);
        return strictVowels <= 2 && threeConsonants && !COMMON_ONSETS.contains(token.substring(0, 3));
    }
}
