package com.cricketlegend.service.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Converts between the typed import records and the jsonb maps the entities hold (docs/specs/097-import-framework.md). */
@Component
public class ImportJson {

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() { };

    private final ObjectMapper mapper;

    public ImportJson(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public Map<String, Object> toMap(Object value) {
        return value == null ? new LinkedHashMap<>() : mapper.convertValue(value, MAP);
    }

    public <T> T fromMap(Map<String, Object> map, Class<T> type) {
        return mapper.convertValue(map == null ? Map.of() : map, type);
    }
}
