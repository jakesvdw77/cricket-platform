package com.cricketlegend.service.support;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * The handler beans keyed by {@link ImportTypeHandler#type()} (docs/specs/097-import-framework.md). Fails at startup on
 * a duplicate type. Only holds and looks up; {@code ImportServiceImpl} is the only class that calls a handler's rules
 * (the one {@code type()} call here is registration, not use, and an ArchUnit rule on handler calls must allow it).
 */
@Component
public class ImportHandlerRegistry {

    private final Map<String, ImportTypeHandler> byType = new LinkedHashMap<>();

    public ImportHandlerRegistry(List<ImportTypeHandler> handlers) {
        for (ImportTypeHandler handler : handlers) {
            if (byType.putIfAbsent(handler.type(), handler) != null) {
                throw new IllegalStateException("Two import handlers claim the type " + handler.type());
            }
        }
    }

    public Optional<ImportTypeHandler> find(String type) {
        return Optional.ofNullable(byType.get(type));
    }

    public Collection<ImportTypeHandler> all() {
        return List.copyOf(byType.values());
    }
}
