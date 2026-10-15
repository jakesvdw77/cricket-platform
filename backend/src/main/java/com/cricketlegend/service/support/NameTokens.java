package com.cricketlegend.service.support;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * A written name split into words, with the word-level helpers the tiers share (docs/specs/104). Case and
 * accents survive in {@link #words()} (initials such as "Cd" need the case); comparisons go through
 * {@link PlayerNameMatcher#canonical} per word, so there is one normaliser. Commas, dots, semicolons and
 * brackets separate words, so "A.B. Nazar" and "Nazar, A" tokenise as expected.
 */
public record NameTokens(List<String> words) {

    /** Particle words {@link PlayerNameMatcher} cannot see on its own, because it only strips one compact prefix. */
    private static final Set<String> EXTRA_PARTICLE_WORDS = Set.of("der", "den", "ten", "ter");

    /** The compact particle prefixes whose abbreviation is two letters ("vander" is "v" and "d"). */
    private static final Set<String> TWO_LETTER_PARTICLES = Set.of("vander", "vanden", "vande", "vd");

    public NameTokens {
        words = List.copyOf(words);
    }

    public static NameTokens of(String name) {
        List<String> words = new ArrayList<>();
        if (name != null) {
            for (String word : name.trim().split("[\\s,.;()]+")) {
                if (!PlayerNameMatcher.canonical(word).isEmpty()) {
                    words.add(word);
                }
            }
        }
        return new NameTokens(words);
    }

    public boolean isEmpty() {
        return words.isEmpty();
    }

    /** The words joined by single spaces. */
    public String joined() {
        return String.join(" ", words);
    }

    /** The two ways to read the words as given names plus surname. A single word reads one way (surname only). */
    public List<Split> splits() {
        List<Split> out = new ArrayList<>(2);
        out.add(surnameLast());
        Split first = surnameFirst();
        if (!first.equals(out.get(0))) {
            out.add(first);
        }
        return out;
    }

    /** "A Nazar", "Sam van der Walt": the surname is the last word plus any particle words before it. */
    private Split surnameLast() {
        int start = words.size() - 1;
        while (start > 0 && isParticle(words.get(start - 1))) {
            start--;
        }
        start = Math.max(start, 0);
        return new Split(words.subList(0, start), words.subList(start, words.size()));
    }

    /** "Nazar A", "van der Walt J": the surname is any leading particle words plus the next word. */
    private Split surnameFirst() {
        int end = 0;
        while (end < words.size() - 1 && isParticle(words.get(end))) {
            end++;
        }
        int next = Math.min(end + 1, words.size());
        return new Split(words.subList(next, words.size()), words.subList(0, next));
    }

    /** One reading of a name: the given-name words and the surname words (either may be empty). */
    public record Split(List<String> given, List<String> surname) {}

    /** True for a surname particle word: the matcher's own prefixes ("van", "de", "vd" ...) plus "der", "den", "ten", "ter". */
    public static boolean isParticle(String word) {
        String compact = PlayerNameMatcher.canonical(word);
        if (compact.isEmpty()) {
            return false;
        }
        // Reuses the matcher's particle list: a particle is a word the matcher strips down to nothing but the probe.
        return EXTRA_PARTICLE_WORDS.contains(compact)
                || PlayerNameMatcher.canonicalSurname(compact + "x").equals("x");
    }

    /**
     * The compact abbreviation of a particle surname as report writers shorten it: particle initials then the
     * first letter of the main surname ("van der Walt" and "VanDerWalt" give "vdw"). Empty when the surname has no
     * leading particle.
     */
    public static String abbreviatedSurname(String lastName) {
        List<String> surnameWords = of(lastName).words();
        if (surnameWords.size() == 1) {
            String compact = PlayerNameMatcher.canonical(surnameWords.get(0));
            String stripped = PlayerNameMatcher.canonicalSurname(compact);
            if (stripped.equals(compact)) {
                return "";
            }
            String prefix = compact.substring(0, compact.length() - stripped.length());
            return particleInitials(prefix) + stripped.charAt(0);
        }
        StringBuilder out = new StringBuilder();
        int index = 0;
        while (index < surnameWords.size() - 1 && isParticle(surnameWords.get(index))) {
            out.append(particleInitials(PlayerNameMatcher.canonical(surnameWords.get(index))));
            index++;
        }
        if (index == 0 || surnameWords.isEmpty()) {
            return "";
        }
        return out.append(PlayerNameMatcher.canonical(surnameWords.get(index)).charAt(0)).toString();
    }

    private static String particleInitials(String compactParticle) {
        return TWO_LETTER_PARTICLES.contains(compactParticle) ? "vd" : compactParticle.substring(0, 1);
    }
}
