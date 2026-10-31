package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportRowDto;
import java.util.Map;

/** A row with its references resolved (own team, league team, venue), the input of {@code identityKey}. */
public record ResolvedRow(ImportRowDto row, Map<String, Object> resolved) {
}
