package com.cricketlegend.dto;

import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportTemplateScope;
import java.util.Map;

/**
 * The JSON {@code scope} part of a preview (docs/specs/097-import-framework.md): the type's own parameters
 * ({@code params}, for example leagueId and seasonId) plus the two framework options. A type without the scope option
 * ignores {@code scopeMode}; both may be null (defaults: {@code ALL}, {@code OURS_AND_OTHERS}).
 */
public record ImportScopeDto(ImportScopeMode scopeMode, ImportTemplateScope templateScope, Map<String, String> params) {
}
