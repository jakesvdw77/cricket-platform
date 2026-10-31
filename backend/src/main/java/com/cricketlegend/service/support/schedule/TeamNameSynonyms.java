package com.cricketlegend.service.support.schedule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The maintained table of team-name synonyms and abbreviations (docs/specs/098-league-schedule-import.md, "Normalisation
 * and matching"): {@code VETERANS = VETS = VETERAN}, {@code CC = CRICKET CLUB}, {@code OB = OLD BOYS} and so on. A plain
 * constant table by decision (plan 098, finding 5). Words are upper case and already normalised. Pure.
 */
public final class TeamNameSynonyms {

    private static final Map<String, String> TO_CANONICAL = new HashMap<>();
    private static final int MAX_WORDS = 2;

    static {
        group("VETERANS", "VETS", "VETERAN", "VET");
        group("CRICKET CLUB", "CC");
        group("OLD BOYS", "OB", "OBS", "OLD BOY");
        group("OLD GIRLS", "OG", "OGS", "OLD GIRL");
        group("HIGH SCHOOL", "HS");
        group("PRIMARY SCHOOL", "PS");
        group("UNITED", "UTD");
        group("SPORTS CLUB", "SC", "SPORT CLUB");
        group("UNIVERSITY", "UNI", "UNIV");
        group("SAINT", "ST");
        group("COLLEGE", "COLL");
        group("ACADEMY", "ACAD");
        group("SENIOR", "SNR", "SR");
        group("JUNIOR", "JNR", "JR");
    }

    private TeamNameSynonyms() {}

    private static void group(String canonical, String... others) {
        TO_CANONICAL.put(canonical, canonical);
        for (String other : others) {
            TO_CANONICAL.put(other, canonical);
        }
    }

    /** The words as written ({@code original}, one or two words) and what they stand for ({@code canonical}). */
    public record Segment(String original, String canonical) {

        public boolean changed() {
            return !original.equals(canonical);
        }
    }

    /** Replaces every known abbreviation or synonym by its canonical form, longest phrase first. */
    public static List<Segment> expand(List<String> words) {
        List<Segment> out = new ArrayList<>();
        int i = 0;
        while (i < words.size()) {
            boolean matched = false;
            for (int len = Math.min(MAX_WORDS, words.size() - i); len >= 1; len--) {
                String phrase = String.join(" ", words.subList(i, i + len));
                String canonical = TO_CANONICAL.get(phrase);
                if (canonical != null) {
                    out.add(new Segment(phrase, canonical));
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                out.add(new Segment(words.get(i), words.get(i)));
                i++;
            }
        }
        return out;
    }

    /** The canonical words (each segment's canonical form split into words). */
    public static List<String> canonicalWords(List<Segment> segments) {
        List<String> words = new ArrayList<>();
        for (Segment segment : segments) {
            words.addAll(List.of(segment.canonical().split(" ")));
        }
        return words;
    }
}
