package com.cricketlegend.dto;

import com.cricketlegend.service.adaptor.AdaptorType;
import java.util.List;

/**
 * docs/specs/104-match-results-import-adaptors.md: what the UI needs to offer one adaptor. {@code aiAllowed} is always
 * false in this revision; {@code example} is a short sample input for a text format, or null;
 * {@code conversionPrompt} is text a manager can paste into their own AI chat with their file, or null.
 */
public record AdaptorDescriptorDto(
        AdaptorType type,
        String displayName,
        String description,
        List<InputFormatDto> inputs,
        boolean aiAllowed,
        String example,
        String conversionPrompt) {
}
