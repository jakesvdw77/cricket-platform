package com.cricketlegend.dto;

import com.cricketlegend.service.adaptor.ImportInputFormat;
import java.util.List;

/**
 * docs/specs/104-match-results-import-adaptors.md: one input format an adaptor accepts. {@code acceptsPaste} equals
 * {@code textBased}; {@code maxBytes} is the largest upload.
 */
public record InputFormatDto(
        ImportInputFormat format, boolean textBased, List<String> extensions, long maxBytes, boolean acceptsPaste) {
}
