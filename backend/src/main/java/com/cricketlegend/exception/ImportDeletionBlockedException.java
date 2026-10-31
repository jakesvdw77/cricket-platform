package com.cricketlegend.exception;

import com.cricketlegend.dto.DeletionBlockerDto;
import java.util.List;

/**
 * Deleting an import is refused because something created by it is depended on (docs/specs/097-import-framework.md,
 * principle 4). Maps to 409 via {@link ConflictException}; {@code GlobalExceptionHandler} adds {@link #getBlockers()}
 * to the problem body. Nothing was deleted.
 */
public class ImportDeletionBlockedException extends ConflictException {

    private final transient List<DeletionBlockerDto> blockers;

    public ImportDeletionBlockedException(String message, List<DeletionBlockerDto> blockers) {
        super(message);
        this.blockers = blockers == null ? List.of() : List.copyOf(blockers);
    }

    public List<DeletionBlockerDto> getBlockers() {
        return blockers;
    }
}
