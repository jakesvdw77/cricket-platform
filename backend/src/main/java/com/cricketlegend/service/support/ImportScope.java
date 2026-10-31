package com.cricketlegend.service.support;

import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportTemplateScope;
import java.util.Map;
import java.util.UUID;

/**
 * Where an import goes (docs/specs/097-import-framework.md): the club, the type's own parameters (for a schedule,
 * {@code leagueId} and {@code seasonId}) and the two framework options. {@code scopeMode} is null for a type without
 * the scope option; {@code templateScope} only matters for a template or the AI help.
 */
public record ImportScope(
        UUID clubId, Map<String, String> params, ImportScopeMode scopeMode, ImportTemplateScope templateScope) {

    public ImportScope {
        params = params == null ? Map.of() : Map.copyOf(params);
    }

    public String param(String name) {
        return params.get(name);
    }
}
