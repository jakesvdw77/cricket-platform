package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.ImportAlias;
import com.cricketlegend.domain.ImportBatch;
import com.cricketlegend.domain.ImportBatchEntity;
import com.cricketlegend.domain.ImportBatchStatus;
import com.cricketlegend.domain.ImportEntityAction;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowStatus;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportSource;
import com.cricketlegend.domain.ImportTemplateScope;
import com.cricketlegend.dto.AiHelpDto;
import com.cricketlegend.dto.CommitImportRequest;
import com.cricketlegend.dto.DeleteImportRequest;
import com.cricketlegend.dto.DeletionBlockerDto;
import com.cricketlegend.dto.DeletionCheckDto;
import com.cricketlegend.dto.ImportBatchDto;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportDecisionsRequest;
import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.ImportScopeDto;
import com.cricketlegend.dto.ImportTemplateDownload;
import com.cricketlegend.dto.ImportTypeDto;
import com.cricketlegend.dto.PlannedChangeDto;
import com.cricketlegend.dto.ReferenceProposalDto;
import com.cricketlegend.exception.ImportBatchExpiredException;
import com.cricketlegend.exception.ImportBatchNotFoundException;
import com.cricketlegend.exception.ImportBatchStateException;
import com.cricketlegend.exception.ImportConfirmationInvalidException;
import com.cricketlegend.exception.ImportDeletionBlockedException;
import com.cricketlegend.exception.ImportFileRejectedException;
import com.cricketlegend.exception.ImportValidationFailedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.ImportMapper;
import com.cricketlegend.repository.ImportAliasRepository;
import com.cricketlegend.repository.ImportBatchEntityRepository;
import com.cricketlegend.repository.ImportBatchRepository;
import com.cricketlegend.repository.ImportBatchSpecifications;
import com.cricketlegend.repository.ImportLockRepository;
import com.cricketlegend.service.ImportService;
import com.cricketlegend.service.support.CommitOutcome;
import com.cricketlegend.service.support.EffectiveImport;
import com.cricketlegend.service.support.ImportBatchFailureRecorder;
import com.cricketlegend.service.support.ImportConfirmationToken;
import com.cricketlegend.service.support.ImportDigest;
import com.cricketlegend.service.support.ImportFile;
import com.cricketlegend.service.support.ImportFileSniffer;
import com.cricketlegend.service.support.ImportHandlerRegistry;
import com.cricketlegend.service.support.ImportJson;
import com.cricketlegend.service.support.ImportLimits;
import com.cricketlegend.service.support.ImportOptions;
import com.cricketlegend.service.support.ImportPayload;
import com.cricketlegend.service.support.ImportPromptLibrary;
import com.cricketlegend.service.support.ImportReview;
import com.cricketlegend.service.support.ImportRowEditor;
import com.cricketlegend.service.support.ImportScope;
import com.cricketlegend.service.support.ImportTypeHandler;
import com.cricketlegend.service.support.ParsedImport;
import com.cricketlegend.service.support.TemplateFormat;
import com.cricketlegend.service.support.ValidationResult;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

/**
 * docs/specs/097-import-framework.md. The only class that calls an {@link ImportTypeHandler}; handlers write only
 * through the existing services. Preview and decisions write only the batch row. Commit verifies the confirmation token
 * (signature, user, age, revision, digest recomputed from stored state), the creations digest, takes the batch row lock
 * and the scope advisory lock, re-validates against live data including record identity and writes in one transaction.
 *
 * <p>Access: the controller gates every call with {@code canAdministerClub} (403 for a club the caller cannot
 * administer); a missing batch or a batch of another club is a 404. A batch is changed or committed only by its creator;
 * any club admin may view and delete a committed import.
 *
 * <p>Nothing here logs file content, row values, tokens or the token secret: logs carry batch and club ids and counts.
 */
@Service
public class ImportServiceImpl implements ImportService {

    private static final Logger log = LoggerFactory.getLogger(ImportServiceImpl.class);

    private static final DateTimeFormatter TEMPLATE_STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmm", Locale.UK);
    private static final DateTimeFormatter WARNING_DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK);
    private static final String BLANK_FILE_NAME = "Typed in the wizard";
    private static final Set<String> HISTORY_SORTS = Set.of("createdAt", "committedAt", "status", "type");

    private final ImportHandlerRegistry registry;
    private final ImportBatchRepository batches;
    private final ImportBatchEntityRepository batchEntities;
    private final ImportAliasRepository aliases;
    private final ImportLockRepository locks;
    private final ImportMapper mapper;
    private final ImportJson json;
    private final ImportDigest digests;
    private final ImportConfirmationToken tokens;
    private final ImportPromptLibrary prompts;
    private final ImportBatchFailureRecorder failures;
    private final AccessService accessService;
    private final Clock clock;

    public ImportServiceImpl(
            ImportHandlerRegistry registry,
            ImportBatchRepository batches,
            ImportBatchEntityRepository batchEntities,
            ImportAliasRepository aliases,
            ImportLockRepository locks,
            ImportMapper mapper,
            ImportJson json,
            ImportDigest digests,
            ImportConfirmationToken tokens,
            ImportPromptLibrary prompts,
            ImportBatchFailureRecorder failures,
            AccessService accessService,
            Clock clock) {
        this.registry = registry;
        this.batches = batches;
        this.batchEntities = batchEntities;
        this.aliases = aliases;
        this.locks = locks;
        this.mapper = mapper;
        this.json = json;
        this.digests = digests;
        this.tokens = tokens;
        this.prompts = prompts;
        this.failures = failures;
        this.accessService = accessService;
        this.clock = clock;
    }

    // ---- discovery, template, AI help ----

    @Override
    @Transactional(readOnly = true)
    public List<ImportTypeDto> types() {
        return registry.all().stream()
                .map(handler -> new ImportTypeDto(
                        handler.type(),
                        handler.label(),
                        handler.templateVersion(),
                        List.of("xlsx", "csv"),
                        handler.supportsOursScope(),
                        ImportLimits.asDto(),
                        !handler.editableColumns().isEmpty(),
                        handler.editableColumns()))
                .sorted(Comparator.comparing(ImportTypeDto::label))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ImportTemplateDownload template(UUID clubId, String type, String format, ImportScopeDto scopeDto) {
        ImportTypeHandler handler = handler(type);
        TemplateFormat templateFormat = TemplateFormat.parse(format);
        if (templateFormat == null) {
            throw new ValidationException("format must be xlsx or csv");
        }
        ImportScope scope = scopeOf(clubId, handler, scopeDto);
        String scopeKey = handler.scopeKey(scope);
        byte[] content = handler.buildTemplate(scope, scope.templateScope(), templateFormat);
        // Short and readable: the type and the time it was made (ids stay out of the name; the scope is in the file's _meta sheet).
        String name = type.toLowerCase(Locale.ROOT).replace('_', '-') + "-template-"
                + TEMPLATE_STAMP.format(clock.instant().atZone(ZoneId.systemDefault()));
        return new ImportTemplateDownload(name + "." + templateFormat.extension(), templateFormat.contentType(), content);
    }

    @Override
    @Transactional(readOnly = true)
    public AiHelpDto aiHelp(UUID clubId, String type, ImportScopeDto scopeDto) {
        ImportTypeHandler handler = handler(type);
        ImportScope scope = scopeOf(clubId, handler, scopeDto);
        handler.scopeKey(scope);
        String base = prompts.load(type, handler.templateVersion()).orElse("");
        String appendix = handler.aiPrompt(scope);
        String prompt = appendix == null || appendix.isBlank() ? base : base + "\n\n" + appendix;
        if (prompt.isBlank()) {
            throw new NotFoundException("No AI help is available for this import type");
        }
        return new AiHelpDto(type, handler.templateVersion(), prompt);
    }

    // ---- preview ----

    @Override
    @Transactional
    public ImportBatchDto preview(
            Authentication authentication,
            UUID clubId,
            String type,
            String fileName,
            byte[] content,
            ImportScopeDto scopeDto,
            String timeZone) {
        ImportTypeHandler handler = handler(type);
        UUID userId = currentUserId(authentication);
        ImportFile file = ImportFileSniffer.sniff(fileName, content);
        enforcePreviewLimits(clubId, userId);
        ImportScope scope = scopeOf(clubId, handler, scopeDto);
        ZoneId zone = zoneOf(timeZone);
        String scopeKey = handler.scopeKey(scope);

        ParsedImport parsed = handler.parse(file, scope, new ImportOptions(zone));
        if (parsed.rows().size() > ImportLimits.MAX_ROWS) {
            throw new ImportFileRejectedException("The file has more than 1,000 data rows. Split it into smaller files.");
        }
        ImportDecisionsDto decisions = ImportDecisionsDto.empty();
        Evaluation evaluation = evaluate(handler, type, parsed, scope, decisions, zone.getId());

        String fileSha = digests.sha256(file.content());
        String rowsSha = digests.rows(parsed.rows());
        String earlier = earlierImportWarning(clubId, type, scopeKey, fileSha, rowsSha, zone);
        return newBatch(handler, userId, scope, scopeKey, zone, ImportSource.TEMPLATE_FILE, file.name(), fileSha,
                rowsSha, file.content().length, evaluation, parsed.rows(), parsed, earlier, decisions);
    }

    /**
     * Spec 125: a batch with no file. Same limits, scope, expiry and history as a preview; the file name, hash and
     * size are placeholders (no migration), the file checks and the whole-file earlier-import check are skipped.
     */
    @Override
    @Transactional
    public ImportBatchDto startBlank(
            Authentication authentication, UUID clubId, String type, ImportScopeDto scopeDto, String timeZone) {
        ImportTypeHandler handler = handler(type);
        if (handler.editableColumns().isEmpty()) {
            throw new ValidationException("This type of import cannot be started without a file.");
        }
        UUID userId = currentUserId(authentication);
        enforcePreviewLimits(clubId, userId);
        ImportScope scope = scopeOf(clubId, handler, scopeDto);
        ZoneId zone = zoneOf(timeZone);
        String scopeKey = handler.scopeKey(scope);

        ParsedImport parsed = new ParsedImport(List.of(), List.of(), Map.of("timeZone", zone.getId()));
        ImportDecisionsDto decisions = ImportDecisionsDto.empty();
        Evaluation evaluation = evaluate(handler, type, parsed, scope, decisions, zone.getId());
        return newBatch(handler, userId, scope, scopeKey, zone, ImportSource.MANUAL, BLANK_FILE_NAME,
                digests.sha256(new byte[0]), digests.rows(List.of()), 0, evaluation, List.of(), parsed, null, decisions);
    }

    private ImportBatchDto newBatch(
            ImportTypeHandler handler,
            UUID userId,
            ImportScope scope,
            String scopeKey,
            ZoneId zone,
            ImportSource source,
            String fileName,
            String fileSha,
            String rowsSha,
            long fileSize,
            Evaluation evaluation,
            List<ImportRowDto> fileRows,
            ParsedImport parsed,
            String earlier,
            ImportDecisionsDto decisions) {
        Instant now = clock.instant();
        ImportPayload payload = payloadOf(evaluation, fileRows, parsed, earlier);
        ImportBatch batch = new ImportBatch();
        batch.setClubId(scope.clubId());
        batch.setType(handler.type());
        batch.setTemplateVersion(handler.templateVersion());
        batch.setSource(source);
        batch.setStatus(ImportBatchStatus.PREVIEW);
        batch.setScopeKey(scopeKey);
        batch.setScope(json.toMap(storedScope(scope)));
        batch.setScopeMode(scope.scopeMode());
        batch.setTimeZone(zone.getId());
        batch.setFileName(fileName);
        batch.setFileSha256(fileSha);
        batch.setRowsSha256(rowsSha);
        batch.setFileSizeBytes(fileSize);
        batch.setPayload(json.toMap(payload));
        batch.setDecisions(json.toMap(decisions));
        batch.setRevision(0);
        batch.setCounts(evaluation.counts());
        batch.setCreatedBy(userId);
        batch.setCreatedAt(now);
        batch.setExpiresAt(now.plus(ImportLimits.IMPORT_PREVIEW_TTL));
        ImportBatch saved = batches.save(batch);
        log.info("Import preview created: batch {} club {} type {} source {} rows {}", saved.getId(), scope.clubId(),
                handler.type(), source, fileRows.size());
        return toDto(saved, payload, firstPage(evaluation.rows()), null, null);
    }

    // ---- read ----

    @Override
    @Transactional(readOnly = true)
    public ImportBatchDto get(UUID clubId, UUID batchId) {
        ImportBatch batch = load(clubId, batchId);
        return toDto(batch, payloadOrNull(batch), null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ImportRowDto> rows(
            UUID clubId, UUID batchId, Set<ImportRowStatus> statuses, Set<ImportOutcome> outcomes, Pageable pageable) {
        ImportBatch batch = load(clubId, batchId);
        ImportPayload payload = payloadOrNull(batch);
        if (payload == null) {
            throw new ImportBatchExpiredException("The rows of this import are no longer stored.");
        }
        List<ImportRowDto> filtered = payload.rows().stream()
                .filter(row -> statuses == null || statuses.isEmpty() || statuses.contains(row.status()))
                .filter(row -> outcomes == null || outcomes.isEmpty() || outcomes.contains(row.outcome()))
                .sorted(rowComparator(pageable.getSort()))
                .toList();
        int size = Math.max(1, Math.min(pageable.getPageSize(), ImportLimits.MAX_PAGE_SIZE));
        long from = (long) pageable.getPageNumber() * size;
        List<ImportRowDto> content = from >= filtered.size()
                ? List.of()
                : filtered.subList((int) from, (int) Math.min(filtered.size(), from + size));
        return new PageImpl<>(content, PageRequest.of(pageable.getPageNumber(), size), filtered.size());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ImportBatchDto> history(
            UUID clubId, String type, String scopeKey, ImportBatchStatus status, boolean includeEnded, Pageable pageable) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        if (pageable.getSort().isSorted()) {
            List<Sort.Order> orders = pageable.getSort().stream()
                    .filter(order -> HISTORY_SORTS.contains(order.getProperty()))
                    .toList();
            if (!orders.isEmpty()) {
                sort = Sort.by(orders);
            }
        }
        int size = Math.max(1, Math.min(pageable.getPageSize(), ImportLimits.MAX_PAGE_SIZE));
        PageRequest request = PageRequest.of(pageable.getPageNumber(), size, sort);
        return batches.findAll(ImportBatchSpecifications.history(clubId, type, scopeKey, status, includeEnded), request)
                .map(batch -> toDto(batch, null, null, null, null));
    }

    // ---- decisions ----

    @Override
    @Transactional
    public ImportBatchDto saveDecisions(
            Authentication authentication, UUID clubId, UUID batchId, ImportDecisionsRequest request) {
        ImportBatch batch = load(clubId, batchId);
        UUID userId = currentUserId(authentication);
        requireOpenPreview(batch, userId);
        if (request.revision() != batch.getRevision()) {
            throw new ImportBatchStateException("This import was changed elsewhere. Reload it and try again.");
        }
        ImportPayload stored = requirePayload(batch);
        ImportTypeHandler handler = handler(batch.getType());
        ImportScope scope = scopeOf(batch);
        ImportDecisionsDto decisions = request.decisions();
        ParsedImport parsed = parsedOf(handler, stored, decisions);
        Evaluation evaluation = evaluate(handler, batch.getType(), parsed, scope, decisions, batch.getTimeZone());
        // Spec 125: a name an edit made vanish keeps no resolution; the cleaned decisions are what is stored and signed.
        ImportDecisionsDto pruned = pruneUnused(decisions, evaluation.proposals());
        if (pruned != decisions) {
            decisions = pruned;
            evaluation = evaluate(handler, batch.getType(), parsed, scope, decisions, batch.getTimeZone());
        }

        batch.setDecisions(json.toMap(decisions));
        applyEvaluation(batch, evaluation, stored.fileRows(), parsed, stored.earlierImportWarning());
        batch.setLastError(null);

        String token = null;
        String creationsDigest = null;
        if (ImportReview.confirmable(evaluation.issues(), decisions, ImportReview.excluded(decisions))) {
            String digest = digests.of(evaluation.effective(), evaluation.planned());
            ImportConfirmationToken.Issued issued = tokens.issue(batch.getId(), batch.getRevision(), digest, userId);
            batch.setConfirmationDigest(digest);
            batch.setTokenIssuedAt(issued.issuedAt());
            token = issued.token();
            creationsDigest = digests.creations(evaluation.planned());
        }
        ImportBatch saved = batches.save(batch);
        return toDto(saved, payloadOf(evaluation, stored.fileRows(), parsed, stored.earlierImportWarning()),
                firstPage(evaluation.rows()), token, creationsDigest);
    }

    // ---- commit ----

    /**
     * No rollback on the two refusals that store a fresh review state first (nothing else has been written when they
     * are thrown). A failure of the handler's own write is rolled back explicitly below.
     */
    @Override
    @Transactional(noRollbackFor = {ImportValidationFailedException.class, ImportBatchStateException.class})
    public ImportBatchDto commit(
            Authentication authentication, UUID clubId, UUID batchId, CommitImportRequest request) {
        ImportBatch batch = batches.findByIdAndClubIdForUpdate(batchId, clubId)
                .orElseThrow(ImportBatchNotFoundException::new);
        UUID userId = currentUserId(authentication);

        if (batch.getStatus() == ImportBatchStatus.COMMITTED) {
            return alreadyCommitted(batch, request, userId);
        }
        requireOpenPreview(batch, userId);
        if (request.revision() != batch.getRevision()) {
            throw new ImportConfirmationInvalidException(
                    "This confirmation is for an earlier version of the import. Review it and confirm again.");
        }
        tokens.validate(request.confirmationToken(), batch.getId(), batch.getRevision(),
                batch.getConfirmationDigest(), userId, true);

        ImportPayload stored = requirePayload(batch);
        ImportTypeHandler handler = handler(batch.getType());
        ImportScope scope = scopeOf(batch);
        ImportDecisionsDto decisions = json.fromMap(batch.getDecisions(), ImportDecisionsDto.class);

        // The stored review must still be exactly what the token was issued for, and what the user saw.
        EffectiveImport storedEffective = effectiveOf(batch, scope, ImportReview.effectiveRows(stored.rows()), decisions);
        if (!batch.getConfirmationDigest().equals(digests.of(storedEffective, stored.plannedChanges()))) {
            throw new ImportConfirmationInvalidException(
                    "The reviewed data no longer matches this confirmation. Review the import and confirm again.");
        }
        if (request.confirmedCreationsDigest() == null
                || !request.confirmedCreationsDigest().equals(digests.creations(stored.plannedChanges()))) {
            throw new ImportConfirmationInvalidException(
                    "The list of records you confirmed does not match the import. Review it and confirm again.");
        }

        locks.lockScope(batch.getClubId() + "|" + batch.getType() + "|" + batch.getScopeKey());

        // Live re-validation, including record identity: data may have changed since the preview.
        ParsedImport parsed = parsedOf(handler, stored, decisions);
        Evaluation live = evaluate(handler, batch.getType(), parsed, scope, decisions, batch.getTimeZone());
        Set<Integer> excluded = ImportReview.excluded(decisions);
        List<ImportIssueDto> blocking = new ArrayList<>(ImportReview.blockingErrors(live.issues(), excluded));
        blocking.addAll(ImportReview.unacknowledgedWarnings(live.issues(), decisions, excluded));
        if (!blocking.isEmpty()) {
            ImportBatchDto fresh = refreshAfterConflict(batch, live, stored.fileRows(), parsed, stored.earlierImportWarning());
            throw new ImportValidationFailedException(
                    "The data changed since you reviewed it and the import now has problems. Nothing was imported.",
                    blocking, fresh);
        }
        if (!batch.getConfirmationDigest().equals(digests.of(live.effective(), live.planned()))) {
            ImportBatchDto fresh = refreshAfterConflict(batch, live, stored.fileRows(), parsed, stored.earlierImportWarning());
            throw new ImportBatchStateException(
                    "The data changed since you reviewed it (for example a record now already exists). "
                            + "Review the updated import and confirm again. Nothing was imported.", fresh);
        }

        CommitOutcome outcome;
        try {
            outcome = handler.commit(authentication, live.effective());
        } catch (RuntimeException ex) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            failures.recordAfterRollback(batch.getId(), failureMessage(ex));
            log.warn("Import commit failed: batch {} club {} ({})", batch.getId(), clubId, ex.getClass().getSimpleName());
            throw ex;
        }
        recordOutcome(batch, outcome, userId);

        Instant now = clock.instant();
        Map<String, Object> counts = new LinkedHashMap<>(live.counts());
        counts.put("committedEntities", outcome.entities().size());
        batch.setCounts(counts);
        batch.setPayload(json.toMap(payloadOf(live, stored.fileRows(), parsed, stored.earlierImportWarning())));
        batch.setStatus(ImportBatchStatus.COMMITTED);
        batch.setCommittedBy(userId);
        batch.setCommittedAt(now);
        batch.setExpiresAt(null);
        batch.setLastError(null);
        ImportBatch saved = batches.save(batch);
        log.info("Import committed: batch {} club {} type {} entities {}", saved.getId(), clubId, saved.getType(),
                outcome.entities().size());
        return toDto(saved, payloadOf(live, stored.fileRows(), parsed, stored.earlierImportWarning()), null, null, null);
    }

    // ---- discard ----

    @Override
    @Transactional
    public ImportBatchDto discard(Authentication authentication, UUID clubId, UUID batchId) {
        ImportBatch batch = batches.findByIdAndClubIdForUpdate(batchId, clubId)
                .orElseThrow(ImportBatchNotFoundException::new);
        UUID userId = currentUserId(authentication);
        switch (batch.getStatus()) {
            case DISCARDED -> {
                return toDto(batch, null, null, null, null);
            }
            case PREVIEW -> {
                requireCreator(batch, userId);
                batch.setStatus(ImportBatchStatus.DISCARDED);
                batch.setPayload(null);
                batch.setConfirmationDigest(null);
                batch.setTokenIssuedAt(null);
                ImportBatch saved = batches.save(batch);
                log.info("Import discarded: batch {} club {}", saved.getId(), clubId);
                return toDto(saved, null, null, null, null);
            }
            case COMMITTED -> throw new ImportBatchStateException(
                    "This import has already been committed. Delete it instead if it was a mistake.");
            default -> throw new ImportBatchStateException("This import can no longer be discarded.");
        }
    }

    // ---- deletion ----

    @Override
    @Transactional(readOnly = true)
    public DeletionCheckDto deletionCheck(UUID clubId, UUID batchId) {
        ImportBatch batch = load(clubId, batchId);
        requireDeletable(batch);
        return handler(batch.getType()).checkDeletion(batch);
    }

    @Override
    @Transactional
    public ImportBatchDto delete(
            Authentication authentication, UUID clubId, UUID batchId, DeleteImportRequest request) {
        ImportBatch batch = batches.findByIdAndClubIdForUpdate(batchId, clubId)
                .orElseThrow(ImportBatchNotFoundException::new);
        if (!request.confirm()) {
            throw new ValidationException("Confirm the deletion to continue.");
        }
        requireDeletable(batch);
        ImportTypeHandler handler = handler(batch.getType());
        locks.lockScope(batch.getClubId() + "|" + batch.getType() + "|" + batch.getScopeKey());

        DeletionCheckDto check = handler.checkDeletion(batch);
        if (!check.deletable()) {
            throw new ImportDeletionBlockedException(
                    "This import cannot be deleted because something it created is now in use.", check.blockers());
        }
        try {
            handler.delete(authentication, batch);
            batches.flush();
        } catch (DataIntegrityViolationException ex) {
            // Something started depending on a record after the check (a poll created a moment ago): same refusal.
            throw new ImportDeletionBlockedException(
                    "This import cannot be deleted because something it created is now in use.",
                    List.of(new DeletionBlockerDto(null, null, "A record created by this import", List.of("IN_USE"),
                            "Something started using a record from this import while it was being deleted.", null)));
        }
        aliases.deactivateByBatch(batch.getId());

        UUID userId = currentUserId(authentication);
        Map<String, Object> counts = new LinkedHashMap<>(batch.getCounts());
        counts.put("deleted", check.willDelete());
        counts.put("kept", check.willKeep());
        batch.setCounts(counts);
        batch.setStatus(ImportBatchStatus.DELETED);
        batch.setDeletedBy(userId);
        batch.setDeletedAt(clock.instant());
        ImportBatch saved = batches.save(batch);
        log.info("Import deleted: batch {} club {}", saved.getId(), clubId);
        return toDto(saved, payloadOrNull(saved), null, null, null);
    }

    // ---- evaluation ----

    private record Evaluation(
            List<ImportRowDto> rows,
            List<ImportIssueDto> issues,
            List<ReferenceProposalDto> proposals,
            List<PlannedChangeDto> planned,
            Map<String, Object> counts,
            EffectiveImport effective) {
    }

    /** Validates with the decisions applied, applies exclusions and, when nothing blocks, lists the planned changes. */
    private Evaluation evaluate(
            ImportTypeHandler handler,
            String type,
            ParsedImport parsed,
            ImportScope scope,
            ImportDecisionsDto decisions,
            String timeZone) {
        ValidationResult result = handler.validate(parsed, scope, decisions);
        List<ImportRowDto> rows = ImportReview.applyExclusions(result.rows(), decisions);
        EffectiveImport effective = new EffectiveImport(
                type, handler.templateVersion(), scope, timeZone, ImportReview.effectiveRows(rows), decisions);
        boolean blocked = !ImportReview.blockingErrors(result.issues(), ImportReview.excluded(decisions)).isEmpty();
        List<PlannedChangeDto> planned = blocked ? List.of() : handler.plannedChanges(effective);
        List<ReferenceProposalDto> proposals = handler.propose(parsed, scope);
        return new Evaluation(rows, result.issues(), proposals, planned, ImportReview.counts(rows, planned), effective);
    }

    private ImportPayload payloadOf(
            Evaluation evaluation, List<ImportRowDto> fileRows, ParsedImport parsed, String earlierImportWarning) {
        return new ImportPayload(evaluation.rows(), fileRows, evaluation.issues(), evaluation.proposals(), evaluation.planned(),
                parsed.fileWarnings(), parsed.meta(), earlierImportWarning);
    }

    private void applyEvaluation(
            ImportBatch batch, Evaluation evaluation, List<ImportRowDto> fileRows, ParsedImport parsed, String earlier) {
        batch.setPayload(json.toMap(payloadOf(evaluation, fileRows, parsed, earlier)));
        batch.setCounts(evaluation.counts());
        batch.setRevision(batch.getRevision() + 1);
        batch.setConfirmationDigest(null);
        batch.setTokenIssuedAt(null);
        batch.setExpiresAt(clock.instant().plus(ImportLimits.IMPORT_PREVIEW_TTL));
    }

    /** Stores the freshly validated state (new revision, no token) and returns it for the 400 or 409 body. */
    private ImportBatchDto refreshAfterConflict(
            ImportBatch batch, Evaluation live, List<ImportRowDto> fileRows, ParsedImport parsed, String earlier) {
        applyEvaluation(batch, live, fileRows, parsed, earlier);
        ImportBatch saved = batches.save(batch);
        return toDto(saved, payloadOf(live, fileRows, parsed, earlier), firstPage(live.rows()), null, null);
    }

    /**
     * The rows every later step works from (spec 125): the stored file rows with the decisions' edits and added rows
     * applied by {@link ImportRowEditor}, the one place that does so. Rejects edits that cannot apply.
     */
    private ParsedImport parsedOf(ImportTypeHandler handler, ImportPayload payload, ImportDecisionsDto decisions) {
        List<ImportTypeDto.EditableColumn> columns = handler.editableColumns();
        ImportRowEditor.validate(payload.fileRows(), decisions, columns);
        return new ParsedImport(ImportRowEditor.apply(payload.fileRows(), decisions, columns), payload.fileWarnings(),
                payload.meta());
    }

    /**
     * Drops resolutions and "identified as ours" entries whose key is in no current proposal (either step). Returns the
     * same instance when nothing was dropped. Keys are compared loosely (case, spacing, punctuation) so a key the
     * client echoed slightly differently from the proposal is never dropped while its name still appears.
     */
    private static ImportDecisionsDto pruneUnused(ImportDecisionsDto decisions, List<ReferenceProposalDto> proposals) {
        Set<String> live = new java.util.HashSet<>();
        proposals.forEach(proposal -> live.add(looseKey(proposal.key())));
        List<ImportDecisionsDto.Resolution> resolutions = decisions.resolutions().stream()
                .filter(resolution -> live.contains(looseKey(resolution.key()))).toList();
        List<String> ours = decisions.identifiedAsOurs().stream().filter(key -> live.contains(looseKey(key))).toList();
        if (resolutions.size() == decisions.resolutions().size() && ours.size() == decisions.identifiedAsOurs().size()) {
            return decisions;
        }
        return new ImportDecisionsDto(decisions.excludedRows(), ours, resolutions, decisions.updates(),
                decisions.updateAllDiffering(), decisions.acknowledgedWarnings(), decisions.options(),
                decisions.rowEdits(), decisions.addedRows());
    }

    private static String looseKey(String key) {
        return key == null ? "" : key.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private EffectiveImport effectiveOf(
            ImportBatch batch, ImportScope scope, List<ImportRowDto> rows, ImportDecisionsDto decisions) {
        ImportTypeHandler handler = handler(batch.getType());
        return new EffectiveImport(batch.getType(), handler.templateVersion(), scope, batch.getTimeZone(), rows, decisions);
    }

    // ---- commit helpers ----

    private ImportBatchDto alreadyCommitted(ImportBatch batch, CommitImportRequest request, UUID userId) {
        if (request.revision() != batch.getRevision()) {
            throw new ImportConfirmationInvalidException("This import has already been committed with a different confirmation.");
        }
        tokens.validate(request.confirmationToken(), batch.getId(), batch.getRevision(),
                batch.getConfirmationDigest(), userId, false);
        return toDto(batch, payloadOrNull(batch), null, null, null);
    }

    private void recordOutcome(ImportBatch batch, CommitOutcome outcome, UUID userId) {
        List<ImportBatchEntity> rows = new ArrayList<>();
        for (CommitOutcome.Committed committed : outcome.entities()) {
            ImportBatchEntity entity = new ImportBatchEntity();
            entity.setBatchId(batch.getId());
            entity.setEntityType(committed.entityType());
            entity.setEntityId(committed.entityId());
            entity.setAction(committed.action());
            entity.setRowNumber(committed.rowNumber());
            entity.setPrevious(committed.previous());
            entity.setDetail(committed.detail());
            rows.add(entity);
        }
        for (CommitOutcome.RememberedAlias remembered : outcome.aliases()) {
            if (aliases.findByClubIdAndKindAndScopeKeyAndAliasNormalisedAndActiveTrue(
                    batch.getClubId(), remembered.kind(), remembered.scopeKey(), remembered.aliasNormalised()).isPresent()) {
                continue;
            }
            ImportAlias alias = new ImportAlias();
            alias.setClubId(batch.getClubId());
            alias.setKind(remembered.kind());
            alias.setScopeKey(remembered.scopeKey());
            alias.setAliasNormalised(remembered.aliasNormalised());
            alias.setAliasOriginal(remembered.aliasOriginal());
            alias.setTargetKind(remembered.targetKind());
            alias.setTargetTeamId(remembered.targetTeamId());
            alias.setTargetName(remembered.targetName());
            alias.setCreatedBy(userId);
            alias.setCreatedByBatch(batch.getId());
            ImportAlias savedAlias = aliases.save(alias);
            ImportBatchEntity entity = new ImportBatchEntity();
            entity.setBatchId(batch.getId());
            entity.setEntityType("IMPORT_ALIAS");
            entity.setEntityId(savedAlias.getId());
            entity.setAction(ImportEntityAction.CREATED);
            rows.add(entity);
        }
        batchEntities.saveAll(rows);
    }

    private static String failureMessage(RuntimeException ex) {
        if (ex instanceof ValidationException || ex instanceof com.cricketlegend.exception.ConflictException) {
            return ex.getMessage();
        }
        return "The import could not be completed and nothing was imported. Try again, or contact support if it keeps happening.";
    }

    // ---- guards ----

    private void requireOpenPreview(ImportBatch batch, UUID userId) {
        if (batch.getStatus() == ImportBatchStatus.EXPIRED) {
            throw new ImportBatchExpiredException("This import has expired. Upload the file again.");
        }
        if (batch.getStatus() != ImportBatchStatus.PREVIEW) {
            throw new ImportBatchStateException("This import is no longer open for changes.");
        }
        requireCreator(batch, userId);
        if (batch.getExpiresAt() != null && !batch.getExpiresAt().isAfter(clock.instant())) {
            throw new ImportBatchExpiredException("This import has expired. Upload the file again.");
        }
    }

    private static void requireCreator(ImportBatch batch, UUID userId) {
        if (!batch.getCreatedBy().equals(userId)) {
            throw new AccessDeniedException("Only the person who started this import can change or confirm it");
        }
    }

    private static void requireDeletable(ImportBatch batch) {
        if (batch.getStatus() == ImportBatchStatus.DELETED) {
            throw new ImportBatchStateException("This import has already been deleted.");
        }
        if (batch.getStatus() != ImportBatchStatus.COMMITTED) {
            throw new ImportBatchStateException("Only an import that has been committed can be deleted.");
        }
    }

    private void enforcePreviewLimits(UUID clubId, UUID userId) {
        if (batches.countByClubIdAndCreatedByAndStatus(clubId, userId, ImportBatchStatus.PREVIEW)
                >= ImportLimits.MAX_OPEN_PREVIEWS_PER_USER) {
            throw new ImportBatchStateException(
                    "You already have 5 imports waiting for confirmation. Finish or discard one before starting another.");
        }
        if (batches.countByClubIdAndStatus(clubId, ImportBatchStatus.PREVIEW) >= ImportLimits.MAX_OPEN_PREVIEWS_PER_CLUB) {
            throw new ImportBatchStateException(
                    "Your club already has 20 imports waiting for confirmation. Ask a colleague to finish or discard theirs.");
        }
        if (batches.countByClubIdAndCreatedAtAfter(clubId, clock.instant().minus(Duration.ofHours(1)))
                >= ImportLimits.MAX_PREVIEWS_PER_CLUB_PER_HOUR) {
            throw new ImportBatchStateException(
                    "Too many imports were started in the last hour. Please wait a little and try again.");
        }
    }

    // ---- lookups and small helpers ----

    private ImportTypeHandler handler(String type) {
        return registry.find(type).orElseThrow(() -> new NotFoundException("Unknown import type"));
    }

    private ImportBatch load(UUID clubId, UUID batchId) {
        return batches.findByIdAndClubId(batchId, clubId).orElseThrow(ImportBatchNotFoundException::new);
    }

    private ImportPayload payloadOrNull(ImportBatch batch) {
        return batch.getPayload() == null ? null : json.fromMap(batch.getPayload(), ImportPayload.class);
    }

    private ImportPayload requirePayload(ImportBatch batch) {
        ImportPayload payload = payloadOrNull(batch);
        if (payload == null) {
            throw new ImportBatchExpiredException("This import has expired. Upload the file again.");
        }
        return payload;
    }

    private ImportBatchDto toDto(
            ImportBatch batch, ImportPayload payload, List<ImportRowDto> firstRows, String token, String creationsDigest) {
        ImportDecisionsDto decisions = batch.getDecisions() == null || batch.getDecisions().isEmpty()
                ? ImportDecisionsDto.empty()
                : json.fromMap(batch.getDecisions(), ImportDecisionsDto.class);
        return mapper.toDto(batch, payload, decisions, firstRows, token, creationsDigest);
    }

    private static List<ImportRowDto> firstPage(List<ImportRowDto> rows) {
        return rows.stream().limit(ImportLimits.FIRST_PAGE_SIZE).toList();
    }

    private ImportScope scopeOf(UUID clubId, ImportTypeHandler handler, ImportScopeDto dto) {
        ImportScopeDto source = dto == null ? new ImportScopeDto(null, null, Map.of()) : dto;
        ImportScopeMode mode = handler.supportsOursScope()
                ? (source.scopeMode() == null ? ImportScopeMode.ALL : source.scopeMode())
                : null;
        ImportTemplateScope templateScope =
                source.templateScope() == null ? ImportTemplateScope.OURS_AND_OTHERS : source.templateScope();
        return new ImportScope(clubId, source.params(), mode, templateScope);
    }

    private ImportScope scopeOf(ImportBatch batch) {
        ImportScopeDto dto = json.fromMap(batch.getScope(), ImportScopeDto.class);
        return new ImportScope(batch.getClubId(), dto.params(), batch.getScopeMode(),
                dto.templateScope() == null ? ImportTemplateScope.OURS_AND_OTHERS : dto.templateScope());
    }

    private static ImportScopeDto storedScope(ImportScope scope) {
        return new ImportScopeDto(scope.scopeMode(), scope.templateScope(), scope.params());
    }

    private static ZoneId zoneOf(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(timeZone.trim());
        } catch (DateTimeException ex) {
            throw new ValidationException("timeZone must be an IANA zone such as Africa/Johannesburg");
        }
    }

    private String earlierImportWarning(
            UUID clubId, String type, String scopeKey, String fileSha, String rowsSha, ZoneId zone) {
        List<ImportBatch> earlier =
                batches.findEarlierCommitted(clubId, type, scopeKey, fileSha, rowsSha, PageRequest.of(0, 1));
        if (earlier.isEmpty() || earlier.get(0).getCommittedAt() == null) {
            return null;
        }
        String when = WARNING_DATE.format(earlier.get(0).getCommittedAt().atZone(zone));
        return "You imported this file on " + when
                + ": importing it again will skip every row that already exists.";
    }

    /** The caller's Person id, or a stable id derived from the Keycloak subject when a platform admin has no Person. */
    private UUID currentUserId(Authentication authentication) {
        UUID personId = accessService.resolveCurrentPersonId(authentication);
        if (personId != null) {
            return personId;
        }
        String subject = authentication == null ? "anonymous" : authentication.getName();
        return UUID.nameUUIDFromBytes(("import-user:" + subject).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static Comparator<ImportRowDto> rowComparator(Sort sort) {
        Comparator<ImportRowDto> byNumber = Comparator.comparingInt(ImportRowDto::rowNumber);
        if (sort == null || !sort.isSorted()) {
            return byNumber;
        }
        Sort.Order order = sort.iterator().next();
        Comparator<ImportRowDto> chosen = switch (order.getProperty()) {
            case "status" -> Comparator.comparing(ImportRowDto::status, Comparator.nullsLast(Comparator.naturalOrder()));
            case "outcome" -> Comparator.comparing(ImportRowDto::outcome, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> byNumber;
        };
        if (order.isDescending()) {
            chosen = chosen.reversed();
        }
        return chosen.thenComparing(byNumber);
    }
}
