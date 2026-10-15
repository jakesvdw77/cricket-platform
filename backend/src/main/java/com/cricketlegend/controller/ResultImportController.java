package com.cricketlegend.controller;

import com.cricketlegend.dto.AdaptorCatalogueDto;
import com.cricketlegend.service.ResultImportService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/104-match-results-import-adaptors.md: importing match results. Club-scoped, any club manager, as result
 * capture ({@link MatchResultController}).
 */
@RestController
public class ResultImportController {

    private final ResultImportService resultImportService;

    public ResultImportController(ResultImportService resultImportService) {
        this.resultImportService = resultImportService;
    }

    /** The registered adaptors and the import limits. Reads no data of the club; the club id is the access check. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/results/import/adaptors")
    public ResponseEntity<AdaptorCatalogueDto> adaptors(@PathVariable UUID clubId) {
        return ResponseEntity.ok(resultImportService.listAdaptors());
    }
}
