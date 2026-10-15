package com.cricketlegend.dto;

import java.util.List;

/** docs/specs/104-match-results-import-adaptors.md: the registered adaptors (by display name) and the import limits. */
public record AdaptorCatalogueDto(List<AdaptorDescriptorDto> adaptors, ImportLimitsDto limits) {
}
