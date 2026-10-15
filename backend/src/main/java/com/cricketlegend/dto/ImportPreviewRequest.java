package com.cricketlegend.dto;

import com.cricketlegend.service.adaptor.AdaptorType;
import com.cricketlegend.service.adaptor.ImportInputFormat;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md: the {@code request} part of a preview. Exactly one of the {@code
 * file} part and {@code content} (a paste, text-based formats only). {@code matchId} is given when the import is launched
 * from a match.
 */
public record ImportPreviewRequest(
        @NotNull AdaptorType adaptor, @NotNull ImportInputFormat format, String content, UUID matchId) {
}
