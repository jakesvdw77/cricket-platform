package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportRowDto;
import java.util.List;

/**
 * What would actually be imported (docs/specs/097-import-framework.md): the type, scope, template version, time zone,
 * the non-excluded rows as validated, and every decision. The confirmation digest is taken over this plus the planned
 * changes list.
 */
public record EffectiveImport(
        String type,
        int templateVersion,
        ImportScope scope,
        String timeZone,
        List<ImportRowDto> rows,
        ImportDecisionsDto decisions) {
}
