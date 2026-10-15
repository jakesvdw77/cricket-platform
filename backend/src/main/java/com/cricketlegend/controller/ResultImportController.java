package com.cricketlegend.controller;

import com.cricketlegend.dto.AdaptorCatalogueDto;
import com.cricketlegend.dto.ImportPreviewDto;
import com.cricketlegend.dto.ImportPreviewRequest;
import com.cricketlegend.dto.ImportResolveDto;
import com.cricketlegend.dto.ImportResolveRequest;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.cricketlegend.service.ResultImportService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/104-match-results-import-adaptors.md: importing match results. Club-scoped, any club manager, as result
 * capture ({@link MatchResultController}); the match's section gate is applied by the service on resolve.
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

    /**
     * Multipart: the JSON part {@code request} and an optional {@code file} part (exactly one of the file and the
     * request's pasted {@code content}). Reads and proposes; writes nothing.
     */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping(
            value = "/api/v1/manage/clubs/{clubId}/results/import/preview",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportPreviewDto> preview(
            Authentication authentication,
            @PathVariable UUID clubId,
            @Valid @RequestPart("request") ImportPreviewRequest request,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        byte[] bytes = null;
        String fileName = null;
        if (file != null && !file.isEmpty()) {
            try {
                bytes = file.getBytes();
            } catch (IOException e) {
                throw new UnreadableImportInputException("The uploaded file could not be read. Try again.");
            }
            fileName = file.getOriginalFilename();
        }
        return ResponseEntity.ok(resultImportService.preview(authentication, clubId, request, fileName, bytes));
    }

    /** The explicit confirm: saves one DRAFT result for the chosen match. Never publishes. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/results/import/resolve")
    public ResponseEntity<ImportResolveDto> resolve(
            Authentication authentication,
            @PathVariable UUID clubId,
            @Valid @RequestBody ImportResolveRequest request) {
        return ResponseEntity.ok(resultImportService.resolve(authentication, clubId, request));
    }
}
