package com.cricketlegend.service;

import com.cricketlegend.domain.ImportBatchStatus;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowStatus;
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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

/**
 * The generic import flow of docs/specs/097-import-framework.md: upload, parse, validate, resolve, confirm, commit,
 * report, delete. It owns the batch, the confirmation token, locking, expiry, history and audit; the type's own rules
 * live in an {@code ImportTypeHandler}, which only this service calls. Every method is club-scoped: a batch of another
 * club reads as {@code ImportBatchNotFoundException}. Nothing but the batch row is written before {@link #commit}.
 */
public interface ImportService {

    List<ImportTypeDto> types();

    ImportTemplateDownload template(UUID clubId, String type, String format, ImportScopeDto scope);

    AiHelpDto aiHelp(UUID clubId, String type, ImportScopeDto scope);

    /** Parses and validates a file and stores a PREVIEW batch; nothing else is written. */
    ImportBatchDto preview(
            Authentication authentication,
            UUID clubId,
            String type,
            String fileName,
            byte[] content,
            ImportScopeDto scope,
            String timeZone);

    /**
     * Spec 125: stores an empty {@code MANUAL} PREVIEW batch (no file) for a type that declares editable columns, so the
     * rows are typed in the wizard. 400 for a type that is not editable; same limits and open-preview caps as preview.
     */
    ImportBatchDto startBlank(
            Authentication authentication, UUID clubId, String type, ImportScopeDto scope, String timeZone);

    ImportBatchDto get(UUID clubId, UUID batchId);

    /**
     * One page of the batch's rows, optionally filtered by status and outcome. Rows live in the stored
     * {@code payload} (a jsonb document of at most 1,000 rows, spec 097 R17), not in a table, so the filter, sort and
     * page are cut in the service from that stored payload, never in the client. This is the one pagination shape the
     * payload design implies and is bounded by the row cap; it is not client-side paging.
     */
    Page<ImportRowDto> rows(
            UUID clubId, UUID batchId, Set<ImportRowStatus> statuses, Set<ImportOutcome> outcomes, Pageable pageable);

    /** Re-validates with the decisions applied, bumps the revision, and issues a token when committable. Creator only. */
    ImportBatchDto saveDecisions(Authentication authentication, UUID clubId, UUID batchId, ImportDecisionsRequest request);

    /** Verifies the token, locks the scope, re-validates against live data and writes in one transaction. */
    ImportBatchDto commit(Authentication authentication, UUID clubId, UUID batchId, CommitImportRequest request);

    /** Ends a PREVIEW; idempotent. Creator only. */
    ImportBatchDto discard(Authentication authentication, UUID clubId, UUID batchId);

    /** Newest first; deleted, discarded and expired batches are left out unless {@code includeEnded} (or an explicit status) asks for them. */
    Page<ImportBatchDto> history(
            UUID clubId, String type, String scopeKey, ImportBatchStatus status, boolean includeEnded, Pageable pageable);

    /** Can this import be deleted? Never writes. */
    DeletionCheckDto deletionCheck(UUID clubId, UUID batchId);

    /** Deletes a committed import as a whole or not at all; re-checks inside the transaction. */
    ImportBatchDto delete(Authentication authentication, UUID clubId, UUID batchId, DeleteImportRequest request);
}
