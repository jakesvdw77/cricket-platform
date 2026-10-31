package com.cricketlegend.controller;

import com.cricketlegend.domain.ImportBatchStatus;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowStatus;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportTemplateScope;
import com.cricketlegend.dto.AiHelpDto;
import com.cricketlegend.dto.CommitImportRequest;
import com.cricketlegend.dto.DeleteImportRequest;
import com.cricketlegend.dto.DeletionCheckDto;
import com.cricketlegend.dto.ImportBatchDto;
import com.cricketlegend.dto.ImportDecisionsRequest;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.ImportScopeDto;
import com.cricketlegend.dto.ImportTemplateDownload;
import com.cricketlegend.dto.ImportTypeDto;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.ImportService;
import com.cricketlegend.service.support.ImportLimits;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/097-import-framework.md: the generic import endpoints on {@code /api/v1/manage/clubs/{clubId}/imports},
 * club admin only ({@code canAdministerClub}; a club the caller cannot administer is 403, a missing batch or one of
 * another club is 404). The type's own scope parameters travel as query parameters (template, ai-help) or in the
 * {@code scope} JSON part (preview). Exceptions map globally via {@code GlobalExceptionHandler}.
 */
@RestController
public class ImportController {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}/imports";
    private static final Set<String> RESERVED_QUERY = Set.of("format", "templateScope", "scopeMode");

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE + "/types")
    public ResponseEntity<List<ImportTypeDto>> listTypes(@PathVariable UUID clubId) {
        return ResponseEntity.ok(importService.types());
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE + "/{type}/template")
    public ResponseEntity<byte[]> downloadTemplate(
            @PathVariable UUID clubId,
            @PathVariable String type,
            @RequestParam String format,
            @RequestParam Map<String, String> query) {
        ImportTemplateDownload download = importService.template(clubId, type, format, scopeFromQuery(query));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(download.fileName()).build().toString())
                .contentType(MediaType.parseMediaType(download.contentType()))
                .body(download.content());
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE + "/{type}/ai-help")
    public ResponseEntity<AiHelpDto> aiHelp(
            @PathVariable UUID clubId, @PathVariable String type, @RequestParam Map<String, String> query) {
        return ResponseEntity.ok(importService.aiHelp(clubId, type, scopeFromQuery(query)));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(value = BASE + "/{type}/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportBatchDto> preview(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable String type,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "scope", required = false) ImportScopeDto scope,
            @RequestParam(value = "timeZone", required = false) String timeZone)
            throws IOException {
        return ResponseEntity.ok(importService.preview(
                authentication, clubId, type, file.getOriginalFilename(), file.getBytes(), scope, timeZone));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/{type}/blank")
    public ResponseEntity<ImportBatchDto> blank(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable String type,
            @RequestBody(required = false) ImportScopeDto scope,
            @RequestParam(value = "timeZone", required = false) String timeZone) {
        return ResponseEntity.ok(importService.startBlank(authentication, clubId, type, scope, timeZone));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE + "/{batchId}")
    public ResponseEntity<ImportBatchDto> get(@PathVariable UUID clubId, @PathVariable UUID batchId) {
        return ResponseEntity.ok(importService.get(clubId, batchId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE + "/{batchId}/rows")
    public ResponseEntity<Page<ImportRowDto>> rows(
            @PathVariable UUID clubId,
            @PathVariable UUID batchId,
            @RequestParam(required = false) List<ImportRowStatus> status,
            @RequestParam(required = false) List<ImportOutcome> outcome,
            @PageableDefault(size = ImportLimits.FIRST_PAGE_SIZE) Pageable pageable) {
        Set<ImportRowStatus> statuses = status == null ? Set.of() : new LinkedHashSet<>(status);
        Set<ImportOutcome> outcomes = outcome == null ? Set.of() : new LinkedHashSet<>(outcome);
        return ResponseEntity.ok(importService.rows(clubId, batchId, statuses, outcomes, pageable));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping(BASE + "/{batchId}/decisions")
    public ResponseEntity<ImportBatchDto> saveDecisions(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID batchId,
            @Valid @RequestBody ImportDecisionsRequest request) {
        return ResponseEntity.ok(importService.saveDecisions(authentication, clubId, batchId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/{batchId}/commit")
    public ResponseEntity<ImportBatchDto> commit(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID batchId,
            @RequestBody CommitImportRequest request) {
        return ResponseEntity.ok(importService.commit(authentication, clubId, batchId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/{batchId}/discard")
    public ResponseEntity<ImportBatchDto> discard(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID batchId) {
        return ResponseEntity.ok(importService.discard(authentication, clubId, batchId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE)
    public ResponseEntity<Page<ImportBatchDto>> history(
            @PathVariable UUID clubId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String scopeKey,
            @RequestParam(required = false) ImportBatchStatus status,
            @RequestParam(defaultValue = "false") boolean includeEnded,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(importService.history(clubId, type, scopeKey, status, includeEnded, pageable));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping(BASE + "/{batchId}/deletion-check")
    public ResponseEntity<DeletionCheckDto> deletionCheck(@PathVariable UUID clubId, @PathVariable UUID batchId) {
        return ResponseEntity.ok(importService.deletionCheck(clubId, batchId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping(BASE + "/{batchId}/delete")
    public ResponseEntity<ImportBatchDto> delete(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID batchId,
            @RequestBody DeleteImportRequest request) {
        return ResponseEntity.ok(importService.delete(authentication, clubId, batchId, request));
    }

    /** Framework options by name, every other query parameter is the type's own scope parameter. */
    private static ImportScopeDto scopeFromQuery(Map<String, String> query) {
        Map<String, String> params = new HashMap<>();
        query.forEach((key, value) -> {
            if (!RESERVED_QUERY.contains(key)) {
                params.put(key, value);
            }
        });
        return new ImportScopeDto(
                parseEnum(ImportScopeMode.class, "scopeMode", query.get("scopeMode")),
                parseEnum(ImportTemplateScope.class, "templateScope", query.get("templateScope")),
                params);
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String name, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ValidationException(name + " is not a recognised value");
        }
    }
}
