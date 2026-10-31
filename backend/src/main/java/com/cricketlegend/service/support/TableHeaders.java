package com.cricketlegend.service.support;

import com.cricketlegend.exception.ImportFileRejectedException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Case-insensitive header matching with a small alias list, shared by both readers (docs/specs/097, "Parsing"). */
final class TableHeaders {

    private final Map<String, String> byNormalised = new HashMap<>();

    /** {@code aliases} maps a canonical column name to the other spellings accepted for it. */
    TableHeaders(Map<String, List<String>> aliases) {
        for (Map.Entry<String, List<String>> entry : aliases.entrySet()) {
            byNormalised.put(normalise(entry.getKey()), entry.getKey());
            for (String alias : entry.getValue()) {
                byNormalised.put(normalise(alias), entry.getKey());
            }
        }
    }

    static String normalise(String header) {
        return header == null ? "" : header.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** Canonical name for a header cell, or null when it matches no known column. */
    String canonical(String header) {
        return byNormalised.get(normalise(header));
    }

    /** Fails on a column that appears twice under the same canonical name. */
    static void rejectDuplicate(Map<String, Integer> seen, String canonical) {
        if (seen.containsKey(canonical)) {
            throw new ImportFileRejectedException("The column '" + canonical + "' appears more than once in the header.");
        }
    }

    static Map<String, Integer> newSeen() {
        return new LinkedHashMap<>();
    }
}
