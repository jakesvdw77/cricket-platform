package com.cricketlegend.service.support;

import com.cricketlegend.domain.ImportMatchLevel;
import com.cricketlegend.domain.NameAlias;
import com.cricketlegend.domain.NameAliasKind;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportNoteDto;
import com.cricketlegend.dto.ImportNoteSeverity;
import com.cricketlegend.dto.ImportNoteSuggestionDto;
import com.cricketlegend.service.support.ImportCandidateLoader.OurCandidate;
import com.cricketlegend.service.support.ImportCandidateLoader.SideCandidates;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md, stage 3: turns the names one side of a file used into the people of
 * that side's scorecard. Pure apart from the club's remembered aliases (read only). Our side resolves against that
 * side's candidates (alias first, which counts as EXACT, then the matcher's tiers, ranked suggestions for what is
 * left); the opposition has no candidates and is only unified within the file. Nothing is ever linked by a fuzzy
 * suggestion, and a name placed by a rule that is a guess carries the guess flag.
 */
@Component
public class ImportPlayerResolver {

    /** One person of a side's scorecard: a registered player of ours, a guest, or an opposition name. */
    public record Person(
            String clientKey,
            ResultSide side,
            boolean opposition,
            String displayName,
            UUID playerProfileId,
            Integer plannedBattingOrder,
            ImportMatchLevel importMatch,
            ImportExactness level) {}

    /** The outcome for one side: its people, who each written spelling is, and the notes and counts. */
    public static final class SideNames {
        private final Map<String, Person> byWritten = new HashMap<>();
        private final List<Person> people = new ArrayList<>();
        private final List<ImportNoteDto> notes = new ArrayList<>();
        private int exact;
        private int normalised;
        private int aiSuggested;
        private int unresolved;

        /** The person a written spelling (as given to {@code resolve}) became. */
        public Person of(String written) {
            return written == null ? null : byWritten.get(written.trim());
        }

        public List<Person> people() {
            return people;
        }

        public List<ImportNoteDto> notes() {
            return notes;
        }

        public int exact() {
            return exact;
        }

        public int normalised() {
            return normalised;
        }

        public int aiSuggested() {
            return aiSuggested;
        }

        public int unresolved() {
            return unresolved;
        }
    }

    /** A placement of one spelling: the matcher's resolution, and whether a suggester (not a rule) made it. */
    private record Placement(NameResolution resolution, boolean suggested) {}

    private final NameAliases aliases;
    private final ObjectProvider<UnresolvedNameSuggester> suggesters;

    public ImportPlayerResolver(NameAliases aliases, ObjectProvider<UnresolvedNameSuggester> suggesters) {
        this.aliases = aliases;
        this.suggesters = suggesters;
    }

    /**
     * Resolves one side. {@code candidates} is null for the opposition. {@code names} are every spelling the file used
     * for the side, in order of first appearance; {@code lists} are the lists a person can appear in only once (an
     * innings' batting order with the non-batters, an innings' bowling list), in file order.
     */
    public SideNames resolve(
            UUID clubId, ResultSide side, SideCandidates candidates, List<String> names, List<List<String>> lists,
            Supplier<String> keys) {
        SideNames out = new SideNames();
        Map<String, String> repOf = new LinkedHashMap<>();
        for (String name : names) {
            String trimmed = name.trim();
            if (!trimmed.isEmpty()) {
                repOf.putIfAbsent(trimmed, repOfSpelling(repOf, trimmed));
            }
        }
        List<String> reps = new ArrayList<>(new LinkedHashSet<>(repOf.values()));
        List<List<String>> repLists = lists.stream()
                .map(list -> list.stream().map(String::trim).filter(repOf::containsKey).map(repOf::get).distinct().toList())
                .toList();

        Map<String, Placement> placed = new LinkedHashMap<>();
        if (candidates != null) {
            placeOurs(clubId, candidates, reps, repLists, placed, out);
        }

        // unify what is not a registered player: all of the opposition, and our guests
        List<String> toUnify = reps.stream()
                .filter(rep -> candidates == null || !placed.get(rep).resolution().isLinked())
                .toList();
        Map<String, String> canonical = unify(toUnify, repLists);

        Map<String, Person> personByRep = new HashMap<>();
        Map<UUID, Person> personByProfile = new HashMap<>();
        Map<String, Person> personByLowerName = new HashMap<>();
        // registered players first, the best spelling of each (EXACT before NORMALISED) names the row
        for (String rep : bestFirst(reps, placed)) {
            Placement placement = candidates == null ? null : placed.get(rep);
            if (placement == null || !placement.resolution().isLinked()) {
                continue;
            }
            NameCandidate candidate = placement.resolution().candidate();
            Person person = personByProfile.get(candidate.id());
            if (person == null) {
                OurCandidate ours = candidates.find(candidate.id());
                ImportMatchLevel flag = placement.suggested()
                        ? ImportMatchLevel.AI_SUGGESTED
                        : (placement.resolution().level() == NameLevel.NORMALISED ? ImportMatchLevel.NORMALISED : null);
                person = new Person(
                        keys.get(), side, false, rep, candidate.id(), ours == null ? null : ours.plannedBattingOrder(),
                        flag, exactnessOf(placement));
                personByProfile.put(candidate.id(), person);
                out.people.add(person);
            }
            personByRep.put(rep, person);
        }
        for (String rep : reps) {
            if (personByRep.containsKey(rep)) {
                continue;
            }
            String target = canonical.get(rep);
            Person person = personByRep.get(target);
            if (person == null) {
                String lower = target.toLowerCase(Locale.ROOT);
                person = personByLowerName.get(lower);
                if (person == null) {
                    boolean opposition = candidates == null;
                    person = new Person(
                            keys.get(), side, opposition, target, null, null, null,
                            opposition ? ImportExactness.EXACT : ImportExactness.UNRESOLVED);
                    personByLowerName.put(lower, person);
                    out.people.add(person);
                }
                personByRep.put(target, person);
            }
            personByRep.put(rep, person);
            if (!rep.equals(target) && candidates == null) {
                out.notes.add(new ImportNoteDto(
                        "OPPOSITION_NAMES_UNIFIED", ImportNoteSeverity.INFO, "players",
                        "'" + rep + "' and '" + target + "' were treated as the same opposition player.", rep, target,
                        ImportExactness.EXACT, List.of()));
            }
        }
        repOf.forEach((written, rep) -> out.byWritten.put(written, personByRep.get(rep)));

        if (candidates != null) {
            notesAndCounts(reps, placed, out);
        }
        return out;
    }

    // ---- our side ----

    private void placeOurs(
            UUID clubId, SideCandidates candidates, List<String> reps, List<List<String>> repLists,
            Map<String, Placement> placed, SideNames out) {
        List<NameCandidate> pool = candidates.names();
        Map<String, NameAlias> remembered = aliases.activeFor(clubId, NameAliasKind.PLAYER, reps);
        for (String rep : reps) {
            Placement placement = null;
            NameAlias alias = remembered.get(NameAliases.normalise(rep));
            if (alias != null) {
                OurCandidate target = candidates.find(alias.getTargetPlayerProfileId());
                if (target != null) {
                    placement = new Placement(
                            NameResolution.matched(rep, NameLevel.EXACT, NameReason.ALIAS, target.name()), false);
                } else {
                    out.notes.add(new ImportNoteDto(
                            "ALIAS_IGNORED", ImportNoteSeverity.WARNING, "players",
                            "A remembered match for '" + rep + "' was ignored because that player is not in this match's"
                                    + " selection or squad.", rep, null, ImportExactness.UNRESOLVED, List.of()));
                }
            }
            placed.put(rep, placement != null ? placement : new Placement(NameResolver.resolve(rep, pool), false));
        }
        // one person per row: a different spelling resolving to the same player in one list is a guest, not a duplicate
        for (List<String> list : repLists) {
            List<NameResolution> before = list.stream().map(rep -> placed.get(rep).resolution()).toList();
            List<NameResolution> after = OnePersonPerRow.apply(before);
            for (int i = 0; i < list.size(); i++) {
                if (after.get(i) != before.get(i)) {
                    placed.put(list.get(i), new Placement(after.get(i), false));
                }
            }
        }
        suggest(reps, pool, placed);
    }

    /** The seam for a later tier: with no suggester (this revision) nothing happens. */
    private void suggest(List<String> reps, List<NameCandidate> pool, Map<String, Placement> placed) {
        List<UnresolvedNameSuggester> all = suggesters.orderedStream().toList();
        if (all.isEmpty()) {
            return;
        }
        List<String> unresolved = reps.stream().filter(rep -> !placed.get(rep).resolution().isLinked()).toList();
        if (unresolved.isEmpty()) {
            return;
        }
        Set<UUID> taken = new HashSet<>();
        placed.values().stream()
                .filter(p -> p.resolution().isLinked())
                .forEach(p -> taken.add(p.resolution().candidate().id()));
        for (UnresolvedNameSuggester suggester : all) {
            Map<String, UnresolvedNameSuggester.Suggestion> answers = suggester.suggest(unresolved, pool);
            for (String rep : unresolved) {
                UnresolvedNameSuggester.Suggestion answer = answers.get(rep);
                if (answer == null || answer.candidate() == null || placed.get(rep).resolution().isLinked()
                        || !pool.contains(answer.candidate()) || !taken.add(answer.candidate().id())) {
                    continue;
                }
                NameResolution previous = placed.get(rep).resolution();
                placed.put(rep, new Placement(
                        new NameResolution(rep, NameLevel.NORMALISED, previous.reason(), answer.candidate(),
                                List.of(), previous.suggestions()), true));
            }
        }
    }

    private static List<String> bestFirst(List<String> reps, Map<String, Placement> placed) {
        return reps.stream()
                .sorted(Comparator.comparingInt(rep -> {
                    Placement p = placed.get(rep);
                    return p == null || !p.resolution().isLinked() ? 2 : (p.resolution().level() == NameLevel.EXACT ? 0 : 1);
                }))
                .toList();
    }

    private static ImportExactness exactnessOf(Placement placement) {
        if (placement.suggested()) {
            return ImportExactness.AI_SUGGESTED;
        }
        return switch (placement.resolution().level()) {
            case EXACT -> ImportExactness.EXACT;
            case NORMALISED -> ImportExactness.NORMALISED;
            case UNRESOLVED -> ImportExactness.UNRESOLVED;
        };
    }

    // ---- notes and counts (our side only) ----

    private static void notesAndCounts(List<String> reps, Map<String, Placement> placed, SideNames out) {
        for (String rep : reps) {
            Placement placement = placed.get(rep);
            NameResolution resolution = placement.resolution();
            ImportExactness level = exactnessOf(placement);
            switch (level) {
                case EXACT -> out.exact++;
                case NORMALISED -> out.normalised++;
                case AI_SUGGESTED -> out.aiSuggested++;
                case UNRESOLVED -> out.unresolved++;
            }
            if (resolution.isLinked()) {
                String name = resolution.candidate().fullName();
                boolean guess = level != ImportExactness.EXACT;
                out.notes.add(new ImportNoteDto(
                        "NAME_" + (placement.suggested() ? "SUGGESTED" : resolution.reason().name()),
                        guess ? ImportNoteSeverity.WARNING : ImportNoteSeverity.INFO, "players",
                        "'" + rep + "' was matched to " + name + " " + phrase(resolution.reason())
                                + (guess ? ". It is a guess: confirm it before publishing." : "."),
                        rep, name, level, List.of()));
            } else {
                List<ImportNoteSuggestionDto> suggestions = resolution.suggestions().stream()
                        .map(s -> new ImportNoteSuggestionDto(s.candidate().id(), s.candidate().fullName(), s.score()))
                        .toList();
                out.notes.add(new ImportNoteDto(
                        "NAME_" + resolution.reason().name(), ImportNoteSeverity.WARNING, "players",
                        unresolvedMessage(rep, resolution, suggestions), rep,
                        resolution.alternatives().isEmpty() ? null : resolution.alternatives().get(0).fullName(),
                        ImportExactness.UNRESOLVED, suggestions));
            }
        }
    }

    private static String unresolvedMessage(String rep, NameResolution resolution, List<ImportNoteSuggestionDto> suggestions) {
        if (resolution.reason() == NameReason.AMBIGUOUS) {
            return "'" + rep + "' could be "
                    + String.join(" or ", resolution.alternatives().stream().map(NameCandidate::fullName).toList())
                    + ". It is a guest until you pick the right player.";
        }
        if (resolution.reason() == NameReason.COLLISION) {
            return "'" + rep + "' fits a player already listed in the same innings, so it is a guest until you pick the"
                    + " right player.";
        }
        return "'" + rep + "' is not in this match's selection or squad, so it is a guest"
                + (suggestions.isEmpty() ? "." : ". Close names are suggested.");
    }

    private static String phrase(NameReason reason) {
        return switch (reason) {
            case EXACT -> "exactly";
            case ALIAS -> "from a name you confirmed before";
            case NORMALISED_EXACT -> "ignoring capitals, accents and spacing";
            case NORMALISED -> "by the order or spelling of the words";
            case INITIALS -> "by initials";
            case SURNAME_INITIAL -> "by given name and the start of the surname";
            case ABBREVIATED_SURNAME -> "by the abbreviated surname";
            case SURNAME_PREFIX -> "by the start of the surname";
            default -> "";
        };
    }

    // ---- unifying spellings of one person ----

    /** The first spelling that equals this one apart from capitals and spacing, else the spelling itself. */
    private static String repOfSpelling(Map<String, String> repOf, String name) {
        String key = name.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        for (Map.Entry<String, String> known : repOf.entrySet()) {
            if (known.getValue().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").equals(key)) {
                return known.getValue();
            }
        }
        return name;
    }

    /**
     * Maps each spelling to the one that names its person: the fullest spelling first, a later one joining it when the
     * deterministic tiers place it on exactly one earlier spelling, unless the two sit in one list (one person once).
     */
    private static Map<String, String> unify(List<String> names, List<List<String>> lists) {
        List<String> order = names.stream()
                .sorted(Comparator
                        .comparingInt((String n) -> NameTokens.of(n).words().size()).reversed()
                        .thenComparing(Comparator.comparingInt(String::length).reversed()))
                .toList();
        Map<String, String> toCanonical = new LinkedHashMap<>();
        List<String> canonical = new ArrayList<>();
        List<NameCandidate> candidates = new ArrayList<>();
        Map<String, List<String>> members = new HashMap<>();
        for (String name : order) {
            String target = null;
            NameResolution resolution = NameTiers.resolve(name, candidates);
            if (resolution.isLinked()) {
                String holder = canonical.get(markerIndex(resolution.candidate().id()));
                boolean together = members.get(holder).stream().anyMatch(member -> shareList(lists, name, member));
                if (!together) {
                    target = holder;
                }
            }
            if (target == null) {
                canonical.add(name);
                candidates.add(asCandidate(canonical.size() - 1, name));
                members.put(name, new ArrayList<>());
                target = name;
            }
            members.get(target).add(name);
            toCanonical.put(name, target);
        }
        return toCanonical;
    }

    private static boolean shareList(List<List<String>> lists, String a, String b) {
        return lists.stream().anyMatch(list -> list.contains(a) && list.contains(b));
    }

    private static NameCandidate asCandidate(int index, String name) {
        String trimmed = name.trim();
        UUID marker = new UUID(0, index + 1L);
        String[] words = trimmed.split("\\s+");
        if (words.length < 2) {
            return new NameCandidate(marker, "", trimmed);
        }
        // The surname starts at the first particle after the given name ("Willem" + "Van Der Nest"), else at the last word.
        int cut = words.length - 1;
        for (int i = 1; i < words.length - 1; i++) {
            if (NameTokens.isParticle(words[i])) {
                cut = i;
                break;
            }
        }
        return new NameCandidate(marker, String.join(" ", Arrays.copyOfRange(words, 0, cut)),
                String.join(" ", Arrays.copyOfRange(words, cut, words.length)));
    }

    private static int markerIndex(UUID marker) {
        return (int) (marker.getLeastSignificantBits() - 1L);
    }
}
