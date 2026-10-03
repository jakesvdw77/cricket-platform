package com.cricketlegend.exception;

import com.cricketlegend.dto.SelectionRejectionDto;
import java.util.List;

/**
 * An apply-selection request had one or more players that cannot be selected; nothing was saved.
 * Maps to HTTP 409 via its {@link ConflictException} base, with the per-player {@link
 * #getRejections()} added to the problem body by {@code GlobalExceptionHandler} — see
 * docs/specs/076-team-selection.md.
 */
public class SelectionRejectedException extends ConflictException {

    private final transient List<SelectionRejectionDto> rejections;

    public SelectionRejectedException(String message, List<SelectionRejectionDto> rejections) {
        super(message);
        this.rejections = List.copyOf(rejections);
    }

    public List<SelectionRejectionDto> getRejections() {
        return rejections;
    }
}
