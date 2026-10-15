package com.cricketlegend.service;

import com.cricketlegend.dto.AdaptorCatalogueDto;

/**
 * docs/specs/104-match-results-import-adaptors.md: result import. This slice has discovery only; preview and resolve
 * arrive with the Result Processor.
 */
public interface ResultImportService {

    /** The registered adaptors and the import limits. Reads no data of the club. */
    AdaptorCatalogueDto listAdaptors();
}
