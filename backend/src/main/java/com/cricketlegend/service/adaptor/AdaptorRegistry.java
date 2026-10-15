package com.cricketlegend.service.adaptor;

import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md: every {@link Adaptor} bean, found automatically, so adding an
 * adaptor needs no registry, endpoint or UI edit. Two adaptors with the same {@link AdaptorType} fail the application
 * at start-up.
 */
@Component
public class AdaptorRegistry {

    private final Map<AdaptorType, Adaptor> byType = new EnumMap<>(AdaptorType.class);

    public AdaptorRegistry(List<Adaptor> adaptors) {
        for (Adaptor adaptor : adaptors) {
            Adaptor previous = byType.put(adaptor.getType(), adaptor);
            if (previous != null) {
                throw new IllegalStateException("Two import adaptors are registered for type " + adaptor.getType()
                        + ": " + previous.getClass().getName() + " and " + adaptor.getClass().getName());
            }
        }
    }

    /** All adaptors, sorted by display name. */
    public List<Adaptor> all() {
        return byType.values().stream().sorted(Comparator.comparing(Adaptor::getDisplayName)).toList();
    }

    public Optional<Adaptor> find(AdaptorType type) {
        return Optional.ofNullable(byType.get(type));
    }
}
