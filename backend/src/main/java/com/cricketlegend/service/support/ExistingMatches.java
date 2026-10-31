package com.cricketlegend.service.support;

import java.util.Map;
import java.util.UUID;

/**
 * The existing records that share an identity key with a row, whoever created them (docs/specs/097, principle 8).
 * {@code attributes} are the non-key attributes the handler compares to decide DUPLICATE or DIFFERS.
 */
public record ExistingMatches(Map<Object, Record> byKey) {

    public ExistingMatches {
        byKey = byKey == null ? Map.of() : byKey;
    }

    public static ExistingMatches none() {
        return new ExistingMatches(Map.of());
    }

    public record Record(String entityType, UUID id, String reference, Map<String, Object> attributes) {
    }
}
