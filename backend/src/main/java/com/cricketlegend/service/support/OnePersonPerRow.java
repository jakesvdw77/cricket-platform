package com.cricketlegend.service.support;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The one-person-per-row rule (docs/specs/104, `101`'s one row per player per innings). Applied to the resolutions
 * of one innings' batting rows in file order: when two <em>differently written</em> rows resolve to the same
 * candidate, the first keeps the link and the later one becomes UNRESOLVED (a guest) with reason COLLISION, never
 * a duplicate row. A row written identically is the same spelling of the same person and is left alone.
 */
public final class OnePersonPerRow {

    private OnePersonPerRow() {}

    public static List<NameResolution> apply(List<NameResolution> inFileOrder) {
        Map<UUID, String> writtenByHolder = new HashMap<>();
        List<NameResolution> out = new ArrayList<>(inFileOrder.size());
        for (NameResolution row : inFileOrder) {
            NameCandidate candidate = row.candidate();
            if (candidate == null || candidate.id() == null) {
                out.add(row);
                continue;
            }
            String key = PlayerNameMatcher.canonical(row.written());
            String holderKey = writtenByHolder.putIfAbsent(candidate.id(), key);
            out.add(holderKey == null || holderKey.equals(key) ? row : row.collidedWith(candidate));
        }
        return out;
    }
}
