package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportRowDto;
import java.util.List;
import java.util.Map;

/**
 * The normalised rows of a file as a handler read them, before validation (docs/specs/097-import-framework.md). Row
 * values must be JSON-simple. {@code fileWarnings} are file-level notes (for example a cell that was cut short) and
 * {@code meta} holds the file's metadata (template version, scope ids) for the handler's own checks. The framework
 * rebuilds a {@code ParsedImport} from the stored rows on every re-validation, so a handler must not depend on the
 * status, outcome or action of an incoming row.
 */
public record ParsedImport(List<ImportRowDto> rows, List<String> fileWarnings, Map<String, String> meta) {

    public ParsedImport {
        rows = rows == null ? List.of() : rows;
        fileWarnings = fileWarnings == null ? List.of() : fileWarnings;
        meta = meta == null ? Map.of() : meta;
    }
}
