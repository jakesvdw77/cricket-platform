package com.cricketlegend.service.support;

import java.time.LocalDate;
import java.time.Period;

/**
 * docs/specs/135 (with 114/122): a player's name for another family's eyes. The initials form is "M. Naidoo", the same
 * wording as the client's {@code shareName}. Pure.
 */
public final class PlayerDisplayName {

    private static final int ADULT_AGE = 18;

    private PlayerDisplayName() {}

    public static String of(String first, String last, boolean initialsOnly) {
        String f = clean(first);
        String l = clean(last);
        if (f.isEmpty() && l.isEmpty()) {
            return "";
        }
        if (f.isEmpty() || l.isEmpty()) {
            String word = f.isEmpty() ? l : f;
            return initialsOnly ? firstLetter(word) + "." : word;
        }
        return initialsOnly ? firstLetter(f) + ". " + l : f + " " + l;
    }

    /** Under 18 today; a missing date of birth counts as an adult. */
    public static boolean isJunior(LocalDate dateOfBirth, LocalDate today) {
        return dateOfBirth != null && Period.between(dateOfBirth, today).getYears() < ADULT_AGE;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String firstLetter(String word) {
        return word.substring(0, word.offsetByCodePoints(0, 1)).toUpperCase();
    }
}
