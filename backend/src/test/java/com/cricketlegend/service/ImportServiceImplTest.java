package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.ImportBatch;
import com.cricketlegend.domain.ImportBatchEntity;
import com.cricketlegend.domain.ImportBatchStatus;
import com.cricketlegend.domain.ImportEntityAction;
import com.cricketlegend.domain.ImportIssueSeverity;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowAction;
import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.domain.ImportRowStatus;
import com.cricketlegend.domain.ImportSource;
import com.cricketlegend.domain.ImportTemplateScope;
import com.cricketlegend.dto.CommitImportRequest;
import com.cricketlegend.dto.DeleteImportRequest;
import com.cricketlegend.dto.DeletionBlockerDto;
import com.cricketlegend.dto.DeletionCheckDto;
import com.cricketlegend.dto.ImportBatchDto;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportDecisionsDto.Acknowledgement;
import com.cricketlegend.dto.ImportDecisionsDto.RowValues;
import com.cricketlegend.dto.ImportDecisionsRequest;
import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.ImportScopeDto;
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
import com.cricketlegend.mapper.ImportMapperImpl;
import com.cricketlegend.repository.ImportAliasRepository;
import com.cricketlegend.repository.ImportBatchEntityRepository;
import com.cricketlegend.repository.ImportBatchRepository;
import com.cricketlegend.repository.ImportLockRepository;
import com.cricketlegend.service.impl.ImportServiceImpl;
import com.cricketlegend.service.support.CommitOutcome;
import com.cricketlegend.service.support.EffectiveImport;
import com.cricketlegend.service.support.ExistingMatches;
import com.cricketlegend.service.support.ImportBatchFailureRecorder;
import com.cricketlegend.service.support.ImportConfirmationToken;
import com.cricketlegend.service.support.ImportDigest;
import com.cricketlegend.service.support.ImportFile;
import com.cricketlegend.service.support.ImportHandlerRegistry;
import com.cricketlegend.service.support.ImportJson;
import com.cricketlegend.service.support.ImportLimits;
import com.cricketlegend.service.support.ImportOptions;
import com.cricketlegend.service.support.ImportPromptLibrary;
import com.cricketlegend.service.support.ImportScope;
import com.cricketlegend.service.support.ImportTypeHandler;
import com.cricketlegend.service.support.ParsedImport;
import com.cricketlegend.service.support.ResolvedRow;
import com.cricketlegend.service.support.TemplateFormat;
import com.cricketlegend.service.support.ValidationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.mock.env.MockEnvironment;

/**
 * docs/specs/097 Test Plan, "Unit (backend)": the batch lifecycle and the server-enforced confirm. A tiny fake handler
 * (names on lines, a name is a duplicate when it is in {@code existing}) stands in for a real type; the repositories are
 * an in-memory map, so what the real classes do with the batch (JSON round trip, digest, token) is exercised for real.
 * "Nothing written" is asserted by the handler's commit count and by the batch-entity repository never being called.
 */
class ImportServiceImplTest {

    private static final String TYPE = "FAKE";
    private static final Instant T0 = Instant.parse("2026-10-30T08:00:00Z");

    /** A clock the test can move. */
    private static final class MovableClock extends Clock {
        private Instant now = T0;

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    /** One name per line; blank is an error, "warn..." a warning, a name already in {@code existing} a duplicate. */
    private static final class FakeHandler implements ImportTypeHandler {
        final Set<String> existing = new HashSet<>();
        final Set<String> nowBad = new HashSet<>();
        int commitCalls;
        int deleteCalls;
        boolean editable = true;
        DeletionCheckDto deletion = new DeletionCheckDto(true, List.of(), Map.of("things", 1), Map.of(), List.of());
        RuntimeException failCommit;

        @Override public String type() { return TYPE; }
        @Override public String label() { return "Fake"; }
        @Override public int templateVersion() { return 1; }
        @Override public boolean supportsOursScope() { return false; }
        @Override public String scopeKey(ImportScope scope) {
            if (scope.params().containsKey("bad")) {
                throw new ValidationException("bad scope");
            }
            return "fake:" + scope.params().getOrDefault("id", "1");
        }
        @Override public List<ImportTypeDto.EditableColumn> editableColumns() {
            return editable ? List.of(new ImportTypeDto.EditableColumn("name", "Name", ImportTypeDto.Kind.TEXT)) : List.of();
        }
        @Override public byte[] buildTemplate(ImportScope scope, ImportTemplateScope templateScope, TemplateFormat format) {
            return "name\n".getBytes(StandardCharsets.UTF_8);
        }
        @Override public String aiPrompt(ImportScope scope) { return ""; }
        @Override public ParsedImport parse(ImportFile file, ImportScope scope, ImportOptions options) {
            List<ImportRowDto> rows = new ArrayList<>();
            String[] lines = new String(file.content(), StandardCharsets.UTF_8).split("\n", -1);
            for (int i = 0; i < lines.length; i++) {
                if (lines[i].isEmpty() && i == lines.length - 1) {
                    continue;
                }
                Map<String, Object> values = new LinkedHashMap<>();
                values.put("name", lines[i]);
                rows.add(new ImportRowDto(i + 2, "line " + (i + 2), values, null, null, null, List.of(), null));
            }
            return new ParsedImport(rows, List.of(), Map.of("timeZone", options.zone().getId()));
        }
        @Override public ValidationResult validate(ParsedImport parsed, ImportScope scope, ImportDecisionsDto decisions) {
            List<ImportRowDto> rows = new ArrayList<>();
            List<ImportIssueDto> issues = new ArrayList<>();
            Set<Integer> excluded = new HashSet<>(decisions.excludedRows());
            for (ImportRowDto row : parsed.rows()) {
                String name = String.valueOf(row.values().get("name")).trim();
                ImportRowStatus status = ImportRowStatus.OK;
                ImportOutcome outcome = ImportOutcome.NEW;
                ImportRowAction action = ImportRowAction.CREATE;
                List<String> codes = new ArrayList<>();
                if (!excluded.contains(row.rowNumber())) {
                    if (name.isEmpty()) {
                        status = ImportRowStatus.ERROR;
                        codes.add("EMPTY_NAME");
                        issues.add(new ImportIssueDto("EMPTY_NAME", ImportIssueSeverity.ERROR, List.of(row.rowNumber()), "name", "Name is blank", null));
                    } else if (nowBad.contains(name.toLowerCase())) {
                        status = ImportRowStatus.ERROR;
                        codes.add("NOW_BAD");
                        issues.add(new ImportIssueDto("NOW_BAD", ImportIssueSeverity.ERROR, List.of(row.rowNumber()), "name", "Now bad", null));
                    } else if (existing.contains(name.toLowerCase())) {
                        outcome = ImportOutcome.DUPLICATE;
                        action = ImportRowAction.SKIP;
                    } else if (name.startsWith("warn")) {
                        status = ImportRowStatus.WARNING;
                        codes.add("ODD_NAME");
                        issues.add(new ImportIssueDto("ODD_NAME", ImportIssueSeverity.WARNING, List.of(row.rowNumber()), "name", "Odd name", null));
                    }
                }
                rows.add(row.withResult(status, outcome, action, codes, null));
            }
            return new ValidationResult(rows, issues);
        }
        @Override public List<ReferenceProposalDto> propose(ParsedImport parsed, ImportScope scope) {
            List<ReferenceProposalDto> out = new ArrayList<>();
            for (ImportRowDto row : parsed.rows()) {
                String name = String.valueOf(row.values().get("name"));
                out.add(new ReferenceProposalDto(name, name, "RESOLVE", List.of(row.rowNumber()), List.of(), name));
            }
            return out;
        }
        @Override public Object identityKey(ResolvedRow row) { return row.row().values().get("name"); }
        @Override public ExistingMatches findExisting(ImportScope scope, Collection<Object> keys) { return ExistingMatches.none(); }
        @Override public List<PlannedChangeDto> plannedChanges(EffectiveImport effective) {
            List<PlannedChangeDto> out = new ArrayList<>();
            for (ImportRowDto row : effective.rows()) {
                if (row.action() == ImportRowAction.CREATE) {
                    out.add(new PlannedChangeDto(ImportEntityAction.CREATED, "THING", String.valueOf(row.values().get("name")),
                            row.rowNumber(), null, null));
                }
            }
            return out;
        }
        @Override public CommitOutcome commit(Authentication auth, EffectiveImport effective) {
            commitCalls++;
            if (failCommit != null) {
                throw failCommit;
            }
            List<CommitOutcome.Committed> made = new ArrayList<>();
            for (PlannedChangeDto change : plannedChanges(effective)) {
                made.add(new CommitOutcome.Committed("THING", UUID.randomUUID(), ImportEntityAction.CREATED, change.rowNumber(), null, null));
            }
            return new CommitOutcome(made, List.of(), Map.of());
        }
        @Override public DeletionCheckDto checkDeletion(ImportBatch batch) { return deletion; }
        @Override public void delete(Authentication auth, ImportBatch batch) { deleteCalls++; }
    }

    private final UUID clubId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final Authentication auth = new TestingAuthenticationToken("me", "n/a");
    private final Map<UUID, ImportBatch> store = new HashMap<>();
    private final MovableClock clock = new MovableClock();
    private FakeHandler handler;
    private ImportBatchRepository batches;
    private ImportBatchEntityRepository batchEntities;
    private ImportAliasRepository aliases;
    private AccessService access;
    private ImportConfirmationToken tokens;
    private ImportServiceImpl service;
    private UUID currentUser;

    @BeforeEach
    void setUp() {
        handler = new FakeHandler();
        currentUser = userId;
        batches = mock(ImportBatchRepository.class);
        batchEntities = mock(ImportBatchEntityRepository.class);
        aliases = mock(ImportAliasRepository.class);
        access = mock(AccessService.class);
        when(access.resolveCurrentPersonId(any())).thenAnswer(inv -> currentUser);
        when(batches.save(any(ImportBatch.class))).thenAnswer(inv -> {
            ImportBatch b = inv.getArgument(0);
            if (b.getId() == null) {
                b.setId(UUID.randomUUID());
            }
            store.put(b.getId(), b);
            return b;
        });
        when(batches.findByIdAndClubId(any(), any())).thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0, UUID.class)))
                .filter(b -> b.getClubId().equals(inv.getArgument(1, UUID.class))));
        when(batches.findByIdAndClubIdForUpdate(any(), any())).thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0, UUID.class)))
                .filter(b -> b.getClubId().equals(inv.getArgument(1, UUID.class))));
        when(batches.findEarlierCommitted(any(), anyString(), anyString(), anyString(), anyString(), any())).thenReturn(List.of());
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        tokens = new ImportConfirmationToken("unit-test-secret", new MockEnvironment(), clock);
        service = new ImportServiceImpl(new ImportHandlerRegistry(List.of(handler)), batches, batchEntities, aliases,
                mock(ImportLockRepository.class), new ImportMapperImpl(), new ImportJson(mapper), new ImportDigest(), tokens,
                mock(ImportPromptLibrary.class), mock(ImportBatchFailureRecorder.class), access, clock);
    }

    // ---- helpers ----

    private ImportBatchDto preview(String... names) {
        return service.preview(auth, clubId, TYPE, "names.csv", String.join("\n", names).getBytes(StandardCharsets.UTF_8),
                new ImportScopeDto(null, null, Map.of()), "UTC");
    }

    /** CSV needs a non-binary name; the fake does not care what the extension is as long as it is accepted. */
    private ImportBatchDto start(String... names) {
        return preview(names);
    }

    private ImportBatchDto decide(ImportBatchDto batch, ImportDecisionsDto decisions) {
        return service.saveDecisions(auth, clubId, batch.id(), new ImportDecisionsRequest(batch.revision(), decisions));
    }

    private static ImportDecisionsDto acking(String code) {
        return new ImportDecisionsDto(null, null, null, null, false, List.of(new Acknowledgement(code, null)), null, null, null);
    }

    private static ImportDecisionsDto excluding(Integer... rows) {
        return new ImportDecisionsDto(List.of(rows), null, null, null, false, null, null, null, null);
    }

    private static ImportDecisionsDto editing(RowValues... edits) {
        return new ImportDecisionsDto(null, null, null, null, false, null, null, List.of(edits), null);
    }

    private CommitImportRequest commitRequest(ImportBatchDto confirmed) {
        return new CommitImportRequest(confirmed.revision(), confirmed.confirmationToken(), confirmed.creationsDigest());
    }

    private ImportBatchDto confirmed(String... names) {
        ImportBatchDto preview = start(names);
        ImportBatchDto decided = decide(preview, ImportDecisionsDto.empty());
        assertThat(decided.confirmationToken()).as("test setup: the import must be confirmable").isNotNull();
        return decided;
    }

    private void assertNothingWritten() {
        assertThat(handler.commitCalls).as("handler commit calls").isZero();
        verify(batchEntities, never()).saveAll(any());
    }

    // ---- preview ----

    @Test
    void previewStoresAPreviewBatchAndWritesNothingElse() {
        ImportBatchDto dto = preview("Alpha", "Beta");

        assertThat(dto.status()).isEqualTo(ImportBatchStatus.PREVIEW);
        assertThat(dto.source()).isEqualTo(ImportSource.TEMPLATE_FILE);
        assertThat(dto.revision()).isZero();
        assertThat(dto.expiresAt()).isEqualTo(T0.plus(ImportLimits.IMPORT_PREVIEW_TTL));
        assertThat(dto.firstRows()).hasSize(2);
        assertThat(dto.confirmationToken()).as("no token before the decisions step").isNull();
        assertThat(dto.plannedChanges()).hasSize(2);
        assertThat(dto.counts()).containsEntry("rows", 2).containsEntry("created", 2L);
        assertNothingWritten();
        assertThat(store.get(dto.id()).getCreatedBy()).isEqualTo(userId);
        assertThat(store.get(dto.id()).getFileSha256()).hasSize(64);
    }

    @Test
    void previewRefusesAnUnknownTypeAndAnUnsafeFile() {
        assertThatThrownBy(() -> service.preview(auth, clubId, "NOPE", "a.csv", new byte[] {'a'}, null, "UTC"))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.preview(auth, clubId, TYPE, "a.xlsm", new byte[] {'a'}, null, "UTC"))
                .isInstanceOf(ImportFileRejectedException.class);
        assertThatThrownBy(() -> service.preview(auth, clubId, TYPE, "a.csv", "a".getBytes(StandardCharsets.UTF_8), null, "Mars/Phobos"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("IANA");
        assertThat(store).isEmpty();
    }

    @Test
    void aBadScopeIsRefusedBeforeAnythingIsStored() {
        assertThatThrownBy(() -> service.preview(auth, clubId, TYPE, "a.csv", "a".getBytes(StandardCharsets.UTF_8),
                new ImportScopeDto(null, null, Map.of("bad", "1")), "UTC")).isInstanceOf(ValidationException.class);
        assertThat(store).isEmpty();
    }

    @Test
    void aFileOverTheRowCapIsRefused() {
        String[] names = new String[ImportLimits.MAX_ROWS + 1];
        java.util.Arrays.fill(names, "x");
        assertThatThrownBy(() -> preview(names)).isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("1,000");
        assertThat(store).isEmpty();
    }

    @Test
    void openPreviewAndHourlyLimitsAreEnforced() {
        when(batches.countByClubIdAndCreatedByAndStatus(clubId, userId, ImportBatchStatus.PREVIEW))
                .thenReturn((long) ImportLimits.MAX_OPEN_PREVIEWS_PER_USER);
        assertThatThrownBy(() -> preview("a")).isInstanceOf(ImportBatchStateException.class).hasMessageContaining("5 imports");

        when(batches.countByClubIdAndCreatedByAndStatus(clubId, userId, ImportBatchStatus.PREVIEW)).thenReturn(0L);
        when(batches.countByClubIdAndStatus(clubId, ImportBatchStatus.PREVIEW)).thenReturn((long) ImportLimits.MAX_OPEN_PREVIEWS_PER_CLUB);
        assertThatThrownBy(() -> preview("a")).isInstanceOf(ImportBatchStateException.class).hasMessageContaining("20 imports");

        when(batches.countByClubIdAndStatus(clubId, ImportBatchStatus.PREVIEW)).thenReturn(0L);
        when(batches.countByClubIdAndCreatedAtAfter(any(), any())).thenReturn((long) ImportLimits.MAX_PREVIEWS_PER_CLUB_PER_HOUR);
        assertThatThrownBy(() -> preview("a")).isInstanceOf(ImportBatchStateException.class).hasMessageContaining("last hour");
        assertThat(store).isEmpty();
    }

    @Test
    void anEarlierCommittedImportOfTheSameFileGivesAWarningText() {
        ImportBatch earlier = new ImportBatch();
        earlier.setCommittedAt(Instant.parse("2026-10-01T10:00:00Z"));
        when(batches.findEarlierCommitted(any(), anyString(), anyString(), anyString(), anyString(), any())).thenReturn(List.of(earlier));
        assertThat(preview("Alpha").earlierImportWarning()).contains("1 Oct 2026").contains("skip every row that already exists");
    }

    // ---- typed-in (blank) import ----

    @Test
    void startBlankStoresAnEmptyManualBatchWithPlaceholders() {
        ImportBatchDto dto = service.startBlank(auth, clubId, TYPE, new ImportScopeDto(null, null, Map.of()), "UTC");
        assertThat(dto.source()).isEqualTo(ImportSource.MANUAL);
        assertThat(dto.status()).isEqualTo(ImportBatchStatus.PREVIEW);
        assertThat(dto.fileName()).isEqualTo("Typed in the wizard");
        assertThat(dto.fileSizeBytes()).isZero();
        assertThat(dto.firstRows()).isEmpty();
        assertThat(dto.earlierImportWarning()).isNull();
        assertThat(store.get(dto.id()).getFileSha256()).isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        verify(batches, never()).findEarlierCommitted(any(), anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void startBlankIsRefusedForATypeThatCannotBeEdited() {
        handler.editable = false;
        assertThatThrownBy(() -> service.startBlank(auth, clubId, TYPE, null, "UTC"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("without a file");
        assertThat(store).isEmpty();
    }

    @Test
    void startBlankCountsAgainstTheOpenPreviewCap() {
        when(batches.countByClubIdAndCreatedByAndStatus(clubId, userId, ImportBatchStatus.PREVIEW)).thenReturn(5L);
        assertThatThrownBy(() -> service.startBlank(auth, clubId, TYPE, null, "UTC")).isInstanceOf(ImportBatchStateException.class);
    }

    // ---- decisions and the token ----

    @Test
    void aTokenIsIssuedOnlyAtZeroErrors() {
        ImportBatchDto preview = start("Alpha", " ");
        ImportBatchDto stillBlocked = decide(preview, ImportDecisionsDto.empty());
        assertThat(stillBlocked.confirmationToken()).isNull();
        assertThat(stillBlocked.creationsDigest()).isNull();
        assertThat(stillBlocked.revision()).isEqualTo(1);

        ImportBatchDto fixed = decide(stillBlocked, excluding(3));
        assertThat(fixed.confirmationToken()).isNotBlank();
        assertThat(fixed.creationsDigest()).isNotBlank();
        assertThat(fixed.revision()).isEqualTo(2);
    }

    @Test
    void aTokenWaitsForEveryWarningToBeAcknowledged() {
        ImportBatchDto preview = start("warn one", "Beta");
        assertThat(decide(preview, ImportDecisionsDto.empty()).confirmationToken()).isNull();
        ImportBatchDto acked = decide(service.get(clubId, preview.id()), acking("ODD_NAME"));
        assertThat(acked.confirmationToken()).isNotBlank();
    }

    @Test
    void everyDecisionBumpsTheRevisionAndInvalidatesTheEarlierToken() {
        ImportBatchDto first = confirmed("Alpha");
        ImportBatchDto second = decide(first, ImportDecisionsDto.empty());
        assertThat(second.revision()).isEqualTo(first.revision() + 1);
        assertThat(store.get(first.id()).getConfirmationDigest()).isNotNull();
        assertThatThrownBy(() -> service.commit(auth, clubId, first.id(), commitRequest(first)))
                .isInstanceOf(ImportConfirmationInvalidException.class);
        assertNothingWritten();
    }

    @Test
    void aStaleRevisionOnDecisionsIsAConflict() {
        ImportBatchDto preview = start("Alpha");
        decide(preview, ImportDecisionsDto.empty());
        assertThatThrownBy(() -> service.saveDecisions(auth, clubId, preview.id(),
                new ImportDecisionsRequest(preview.revision(), ImportDecisionsDto.empty())))
                .isInstanceOf(ImportBatchStateException.class).hasMessageContaining("changed elsewhere");
    }

    @Test
    void onlyTheCreatorMayChangeCommitOrDiscard() {
        ImportBatchDto ok = confirmed("Alpha");
        currentUser = UUID.randomUUID();
        assertThatThrownBy(() -> decide(ok, ImportDecisionsDto.empty())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.commit(auth, clubId, ok.id(), commitRequest(ok))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.discard(auth, clubId, ok.id())).isInstanceOf(AccessDeniedException.class);
        assertNothingWritten();
        assertThat(store.get(ok.id()).getStatus()).isEqualTo(ImportBatchStatus.PREVIEW);
    }

    @Test
    void aBatchOfAnotherClubReadsAsNotFound() {
        ImportBatchDto dto = preview("Alpha");
        UUID other = UUID.randomUUID();
        assertThatThrownBy(() -> service.get(other, dto.id())).isInstanceOf(ImportBatchNotFoundException.class);
        assertThatThrownBy(() -> service.rows(other, dto.id(), null, null, PageRequest.of(0, 10))).isInstanceOf(ImportBatchNotFoundException.class);
        assertThatThrownBy(() -> service.saveDecisions(auth, other, dto.id(), new ImportDecisionsRequest(0, ImportDecisionsDto.empty())))
                .isInstanceOf(ImportBatchNotFoundException.class);
        assertThatThrownBy(() -> service.commit(auth, other, dto.id(), new CommitImportRequest(0, "x", "y")))
                .isInstanceOf(ImportBatchNotFoundException.class);
        assertThatThrownBy(() -> service.discard(auth, other, dto.id())).isInstanceOf(ImportBatchNotFoundException.class);
        assertThatThrownBy(() -> service.deletionCheck(other, dto.id())).isInstanceOf(ImportBatchNotFoundException.class);
        assertThatThrownBy(() -> service.delete(auth, other, dto.id(), new DeleteImportRequest(true))).isInstanceOf(ImportBatchNotFoundException.class);
        assertNothingWritten();
    }

    // ---- no commit without a valid token (nothing written in every case) ----

    @Test
    void commitWithoutATokenIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision(), null, c.creationsDigest())))
                .isInstanceOf(ImportConfirmationInvalidException.class).hasMessageContaining("required");
        assertNothingWritten();
        assertThat(store.get(c.id()).getStatus()).isEqualTo(ImportBatchStatus.PREVIEW);
    }

    @Test
    void commitWithATamperedTokenIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        String token = c.confirmationToken();
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision(), tampered, c.creationsDigest())))
                .isInstanceOf(ImportConfirmationInvalidException.class);
        assertNothingWritten();
    }

    @Test
    void commitWithATokenIssuedToAnotherUserIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        ImportBatch stored = store.get(c.id());
        String others = tokens.issue(stored.getId(), stored.getRevision(), stored.getConfirmationDigest(), UUID.randomUUID()).token();
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision(), others, c.creationsDigest())))
                .isInstanceOf(ImportConfirmationInvalidException.class);
        assertNothingWritten();
    }

    @Test
    void commitWithAnExpiredTokenIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        clock.advance(ImportLimits.IMPORT_TOKEN_TTL.plusSeconds(1));
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c)))
                .isInstanceOf(ImportConfirmationInvalidException.class).hasMessageContaining("expired");
        assertNothingWritten();
    }

    @Test
    void commitWithAStaleRevisionIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision() - 1, c.confirmationToken(), c.creationsDigest())))
                .isInstanceOf(ImportConfirmationInvalidException.class).hasMessageContaining("earlier version");
        assertNothingWritten();
    }

    @Test
    void commitWhenTheStoredReviewNoLongerMatchesTheDigestIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        ImportBatch stored = store.get(c.id());
        Map<String, Object> payload = new HashMap<>(stored.getPayload());
        payload.put("plannedChanges", List.of());
        stored.setPayload(payload);
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c)))
                .isInstanceOf(ImportConfirmationInvalidException.class).hasMessageContaining("no longer matches");
        assertNothingWritten();
    }

    @Test
    void commitWithADifferentCreationsDigestIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision(), c.confirmationToken(), "0".repeat(64))))
                .isInstanceOf(ImportConfirmationInvalidException.class).hasMessageContaining("list of records");
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision(), c.confirmationToken(), null)))
                .isInstanceOf(ImportConfirmationInvalidException.class);
        assertNothingWritten();
    }

    @Test
    void commitOfAnExpiredPreviewIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        clock.advance(ImportLimits.IMPORT_PREVIEW_TTL.plusSeconds(1));
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c))).isInstanceOf(ImportBatchExpiredException.class);
        assertNothingWritten();
    }

    @Test
    void commitOfABatchTheExpiryJobAlreadyExpiredIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        ImportBatch stored = store.get(c.id());
        stored.setStatus(ImportBatchStatus.EXPIRED);
        stored.setPayload(null);
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c))).isInstanceOf(ImportBatchExpiredException.class);
        assertThatThrownBy(() -> decide(c, ImportDecisionsDto.empty())).isInstanceOf(ImportBatchExpiredException.class);
        assertNothingWritten();
    }

    @Test
    void aTokenFromAFileThenEditedRowIsInvalidAfterTheEdit() {
        ImportBatchDto preview = start("Alpha");
        ImportBatchDto c = decide(preview, ImportDecisionsDto.empty());
        decide(c, editing(new RowValues(2, Map.of("name", "Alpha two"))));
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c))).isInstanceOf(ImportConfirmationInvalidException.class);
        assertNothingWritten();
    }

    // ---- commit ----

    @Test
    void aValidCommitWritesOnceRecordsTheEntitiesAndMarksTheBatchCommitted() {
        ImportBatchDto c = confirmed("Alpha", "Beta");
        ImportBatchDto done = service.commit(auth, clubId, c.id(), commitRequest(c));

        assertThat(done.status()).isEqualTo(ImportBatchStatus.COMMITTED);
        assertThat(done.committedBy()).isEqualTo(userId);
        assertThat(done.committedAt()).isEqualTo(T0);
        assertThat(done.expiresAt()).isNull();
        assertThat(done.counts()).containsEntry("committedEntities", 2);
        assertThat(handler.commitCalls).isEqualTo(1);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ImportBatchEntity>> saved = ArgumentCaptor.forClass(List.class);
        verify(batchEntities).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(2).allSatisfy(e -> {
            assertThat(e.getBatchId()).isEqualTo(c.id());
            assertThat(e.getEntityType()).isEqualTo("THING");
            assertThat(e.getAction()).isEqualTo(ImportEntityAction.CREATED);
        });
    }

    @Test
    void aRepeatedCommitReturnsTheStoredReportAndWritesNothingMore() {
        ImportBatchDto c = confirmed("Alpha");
        service.commit(auth, clubId, c.id(), commitRequest(c));
        clock.advance(Duration.ofHours(2));
        ImportBatchDto again = service.commit(auth, clubId, c.id(), commitRequest(c));

        assertThat(again.status()).isEqualTo(ImportBatchStatus.COMMITTED);
        assertThat(handler.commitCalls).as("the retry proves the same confirmation, even aged").isEqualTo(1);
    }

    @Test
    void aRepeatedCommitWithADifferentRevisionOrTokenIsRefused() {
        ImportBatchDto c = confirmed("Alpha");
        service.commit(auth, clubId, c.id(), commitRequest(c));
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision() + 1, c.confirmationToken(), c.creationsDigest())))
                .isInstanceOf(ImportConfirmationInvalidException.class);
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), new CommitImportRequest(c.revision(), "bogus.token", c.creationsDigest())))
                .isInstanceOf(ImportConfirmationInvalidException.class);
        assertThat(handler.commitCalls).isEqualTo(1);
    }

    @Test
    void commitRevalidatesAgainstLiveDataAndAnswersWithFreshStateWhenARecordAppeared() {
        ImportBatchDto c = confirmed("Alpha", "Beta");
        handler.existing.add("alpha"); // someone created it between the review and the commit

        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c)))
                .isInstanceOfSatisfying(ImportBatchStateException.class, ex -> {
                    assertThat(ex.getMessage()).contains("Nothing was imported");
                    ImportBatchDto fresh = ex.getBatch();
                    assertThat(fresh.revision()).isGreaterThan(c.revision());
                    assertThat(fresh.confirmationToken()).as("a fresh review needs a fresh confirmation").isNull();
                    assertThat(fresh.plannedChanges()).extracting(PlannedChangeDto::label).containsExactly("Beta");
                });
        assertNothingWritten();
        ImportBatch stored = store.get(c.id());
        assertThat(stored.getStatus()).isEqualTo(ImportBatchStatus.PREVIEW);
        assertThat(stored.getConfirmationDigest()).isNull();
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c)))
                .as("the old token cannot be replayed").isInstanceOf(ImportConfirmationInvalidException.class);
    }

    @Test
    void commitRefusesWithTheIssuesWhenLiveDataNowCausesAnError() {
        ImportBatchDto c = confirmed("Alpha", "Beta");
        handler.nowBad.add("beta");

        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c)))
                .isInstanceOfSatisfying(ImportValidationFailedException.class, ex -> {
                    assertThat(ex.getMessage()).contains("Nothing was imported");
                    assertThat(ex.getIssues()).extracting(ImportIssueDto::code).containsExactly("NOW_BAD");
                    assertThat(ex.getBatch().revision()).isGreaterThan(c.revision());
                    assertThat(ex.getBatch().confirmationToken()).isNull();
                });
        assertNothingWritten();
        assertThat(store.get(c.id()).getStatus()).isEqualTo(ImportBatchStatus.PREVIEW);
    }

    @Test
    void aRowTheHandlerWouldSkipIsNeverWritten() {
        handler.existing.add("alpha");
        ImportBatchDto c = confirmed("Alpha", "Beta");
        assertThat(c.plannedChanges()).extracting(PlannedChangeDto::label).containsExactly("Beta");
        service.commit(auth, clubId, c.id(), commitRequest(c));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ImportBatchEntity>> saved = ArgumentCaptor.forClass(List.class);
        verify(batchEntities).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(1).allSatisfy(e -> assertThat(e.getRowNumber()).isEqualTo(3));
    }

    @Test
    void anExcludedRowIsNeverWritten() {
        ImportBatchDto preview = start("Alpha", "Beta", "Gamma");
        ImportBatchDto c = decide(preview, excluding(3));
        service.commit(auth, clubId, c.id(), commitRequest(c));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ImportBatchEntity>> saved = ArgumentCaptor.forClass(List.class);
        verify(batchEntities).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(ImportBatchEntity::getRowNumber).containsExactlyInAnyOrder(2, 4);
    }

    // ---- editable rows (spec 125) ----

    @Test
    void anEditIsAppliedBeforeValidationAndMarksTheRowEdited() {
        ImportBatchDto preview = start("Alpha", " ");
        ImportBatchDto edited = decide(preview, editing(new RowValues(3, Map.of("name", "Gamma"))));
        assertThat(edited.confirmationToken()).as("the blank was the only error and the edit fixes it").isNotNull();
        ImportRowDto row = service.rows(clubId, preview.id(), null, null, PageRequest.of(0, 10)).getContent().get(1);
        assertThat(row.values()).containsEntry("name", "Gamma");
        assertThat(row.origin()).isEqualTo(ImportRowOrigin.EDITED);
        assertThat(row.fileValues()).containsEntry("name", " ");
        assertThat(edited.counts()).containsEntry("edited", 1);
    }

    @Test
    void anAddedRowIsNumberedFromOneThousandAndOneAndIsCommitted() {
        ImportBatchDto blank = service.startBlank(auth, clubId, TYPE, null, "UTC");
        ImportDecisionsDto added = new ImportDecisionsDto(null, null, null, null, false, null, null, null,
                List.of(new RowValues(1001, Map.of("name", "Typed one")), new RowValues(1002, Map.of("name", "Typed two"))));
        ImportBatchDto c = decide(blank, added);
        assertThat(c.confirmationToken()).isNotNull();
        assertThat(c.counts()).containsEntry("added", 2).containsEntry("created", 2L);

        ImportBatchDto done = service.commit(auth, clubId, c.id(), commitRequest(c));
        assertThat(done.status()).isEqualTo(ImportBatchStatus.COMMITTED);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ImportBatchEntity>> saved = ArgumentCaptor.forClass(List.class);
        verify(batchEntities).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(ImportBatchEntity::getRowNumber).containsExactlyInAnyOrder(1001, 1002);
    }

    @Test
    void anEditThatCannotApplyIsRejectedAndStoresNothingNew() {
        ImportBatchDto preview = start("Alpha");
        assertThatThrownBy(() -> decide(preview, editing(new RowValues(9, Map.of("name", "x")))))
                .isInstanceOf(ValidationException.class).hasMessageContaining("Row 9 does not exist");
        assertThatThrownBy(() -> decide(preview, editing(new RowValues(2, Map.of("bogus", "x")))))
                .isInstanceOf(ValidationException.class).hasMessageContaining("cannot be edited");
        assertThat(store.get(preview.id()).getRevision()).isZero();
    }

    @Test
    void editsAreRefusedForATypeThatIsNotEditable() {
        ImportBatchDto preview = start("Alpha");
        handler.editable = false;
        assertThatThrownBy(() -> decide(preview, editing(new RowValues(2, Map.of("name", "x")))))
                .isInstanceOf(ValidationException.class).hasMessageContaining("cannot be edited");
    }

    @Test
    void aResolutionWhoseNameNoLongerAppearsAfterAnEditIsDropped() {
        ImportBatchDto preview = start("Alpha", "Beta");
        ImportDecisionsDto withResolution = new ImportDecisionsDto(null, null,
                List.of(new ImportDecisionsDto.Resolution("Beta", com.cricketlegend.domain.ImportResolutionKind.CREATE, null, null, "Beta", false, null)),
                null, false, null, null, null, null);
        ImportBatchDto first = decide(preview, withResolution);
        assertThat(first.decisions().resolutions()).hasSize(1);

        ImportBatchDto edited = decide(first, new ImportDecisionsDto(null, null, withResolution.resolutions(), null, false, null, null,
                List.of(new RowValues(3, Map.of("name", "Delta"))), null));
        assertThat(edited.decisions().resolutions()).as("Beta no longer appears, so its resolution is dropped").isEmpty();
        assertThat(edited.decisions().rowEdits()).hasSize(1);
    }

    @Test
    void aResolutionKeyEchoedWithDifferentCaseOrSpacingIsKept() {
        ImportBatchDto preview = start("Alpha Beta");
        ImportDecisionsDto d = new ImportDecisionsDto(null, null,
                List.of(new ImportDecisionsDto.Resolution("ALPHA  beta", com.cricketlegend.domain.ImportResolutionKind.CREATE, null, null, "x", false, null)),
                null, false, null, null, null, null);
        assertThat(decide(preview, d).decisions().resolutions()).hasSize(1);
    }

    // ---- rows paging ----

    @Test
    void rowsAreFilteredByStatusAndOutcomeSortedAndPagedFromTheStoredPayload() {
        handler.existing.add("dup");
        ImportBatchDto preview = start("Alpha", " ", "Dup", "Beta", "warn me");

        var errors = service.rows(clubId, preview.id(), Set.of(ImportRowStatus.ERROR), null, PageRequest.of(0, 10));
        assertThat(errors.getContent()).extracting(ImportRowDto::rowNumber).containsExactly(3);
        var dups = service.rows(clubId, preview.id(), null, Set.of(ImportOutcome.DUPLICATE), PageRequest.of(0, 10));
        assertThat(dups.getContent()).extracting(ImportRowDto::rowNumber).containsExactly(4);
        var page2 = service.rows(clubId, preview.id(), null, null, PageRequest.of(1, 2));
        assertThat(page2.getContent()).extracting(ImportRowDto::rowNumber).containsExactly(4, 5);
        assertThat(page2.getTotalElements()).isEqualTo(5);
        var byStatus = service.rows(clubId, preview.id(), null, null, PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "status")));
        assertThat(byStatus.getContent().get(0).status()).isEqualTo(ImportRowStatus.ERROR);
        var beyond = service.rows(clubId, preview.id(), null, null, PageRequest.of(9, 10));
        assertThat(beyond.getContent()).isEmpty();
        var capped = service.rows(clubId, preview.id(), null, null, PageRequest.of(0, 5000));
        assertThat(capped.getSize()).isEqualTo(ImportLimits.MAX_PAGE_SIZE);
    }

    @Test
    void rowsOfAnExpiredBatchAreGone() {
        ImportBatchDto preview = start("Alpha");
        ImportBatch stored = store.get(preview.id());
        stored.setStatus(ImportBatchStatus.EXPIRED);
        stored.setPayload(null);
        assertThatThrownBy(() -> service.rows(clubId, preview.id(), null, null, PageRequest.of(0, 10)))
                .isInstanceOf(ImportBatchExpiredException.class);
        assertThat(service.get(clubId, preview.id()).issues()).isNull();
    }

    // ---- discard ----

    @Test
    void discardEndsAPreviewDropsItsPayloadAndIsIdempotent() {
        ImportBatchDto c = confirmed("Alpha");
        ImportBatchDto discarded = service.discard(auth, clubId, c.id());
        assertThat(discarded.status()).isEqualTo(ImportBatchStatus.DISCARDED);
        ImportBatch stored = store.get(c.id());
        assertThat(stored.getPayload()).isNull();
        assertThat(stored.getConfirmationDigest()).isNull();
        assertThat(service.discard(auth, clubId, c.id()).status()).isEqualTo(ImportBatchStatus.DISCARDED);
        assertThatThrownBy(() -> service.commit(auth, clubId, c.id(), commitRequest(c))).isInstanceOf(ImportBatchStateException.class);
        assertNothingWritten();
    }

    @Test
    void aCommittedImportCannotBeDiscarded() {
        ImportBatchDto c = confirmed("Alpha");
        service.commit(auth, clubId, c.id(), commitRequest(c));
        assertThatThrownBy(() -> service.discard(auth, clubId, c.id()))
                .isInstanceOf(ImportBatchStateException.class).hasMessageContaining("Delete it instead");
    }

    @Test
    void decisionsOnACommittedOrDiscardedImportAreRefused() {
        ImportBatchDto c = confirmed("Alpha");
        service.commit(auth, clubId, c.id(), commitRequest(c));
        assertThatThrownBy(() -> decide(c, ImportDecisionsDto.empty())).isInstanceOf(ImportBatchStateException.class);
    }

    // ---- deletion ----

    @Test
    void deletionNeedsACommittedImportAndAnExplicitConfirm() {
        ImportBatchDto c = confirmed("Alpha");
        assertThatThrownBy(() -> service.deletionCheck(clubId, c.id())).isInstanceOf(ImportBatchStateException.class)
                .hasMessageContaining("committed");
        assertThatThrownBy(() -> service.delete(auth, clubId, c.id(), new DeleteImportRequest(false)))
                .isInstanceOf(ValidationException.class);
        service.commit(auth, clubId, c.id(), commitRequest(c));
        assertThatThrownBy(() -> service.delete(auth, clubId, c.id(), new DeleteImportRequest(false)))
                .isInstanceOf(ValidationException.class).hasMessageContaining("Confirm the deletion");
        assertThat(handler.deleteCalls).isZero();
    }

    @Test
    void deleteMarksTheBatchDeletedRecordsCountsAndDeactivatesItsAliases() {
        ImportBatchDto c = confirmed("Alpha");
        service.commit(auth, clubId, c.id(), commitRequest(c));
        ImportBatchDto deleted = service.delete(auth, clubId, c.id(), new DeleteImportRequest(true));

        assertThat(deleted.status()).isEqualTo(ImportBatchStatus.DELETED);
        assertThat(deleted.deletedBy()).isEqualTo(userId);
        assertThat(deleted.counts()).containsEntry("deleted", Map.of("things", 1));
        assertThat(handler.deleteCalls).isEqualTo(1);
        verify(aliases).deactivateByBatch(c.id());
        assertThatThrownBy(() -> service.delete(auth, clubId, c.id(), new DeleteImportRequest(true)))
                .isInstanceOf(ImportBatchStateException.class).hasMessageContaining("already been deleted");
    }

    @Test
    void aBlockedDeletionIsRefusedWithTheBlockersAndDeletesNothing() {
        ImportBatchDto c = confirmed("Alpha");
        service.commit(auth, clubId, c.id(), commitRequest(c));
        handler.deletion = new DeletionCheckDto(false,
                List.of(new DeletionBlockerDto("MATCH", UUID.randomUUID(), "13 Sep", List.of("POLL"), "has a poll", null)),
                Map.of(), Map.of(), List.of());
        assertThatThrownBy(() -> service.delete(auth, clubId, c.id(), new DeleteImportRequest(true)))
                .isInstanceOfSatisfying(ImportDeletionBlockedException.class,
                        ex -> assertThat(ex.getBlockers()).singleElement().satisfies(b -> assertThat(b.reasons()).containsExactly("POLL")));
        assertThat(handler.deleteCalls).isZero();
        assertThat(store.get(c.id()).getStatus()).isEqualTo(ImportBatchStatus.COMMITTED);
    }

    // ---- types, template, history ----

    @Test
    void typesListEditabilityAndLimits() {
        List<ImportTypeDto> types = service.types();
        assertThat(types).singleElement().satisfies(t -> {
            assertThat(t.type()).isEqualTo(TYPE);
            assertThat(t.editable()).isTrue();
            assertThat(t.editableColumns()).extracting(ImportTypeDto.EditableColumn::key).containsExactly("name");
            assertThat(t.limits().maxRows()).isEqualTo(ImportLimits.MAX_ROWS);
            assertThat(t.formats()).containsExactly("xlsx", "csv");
        });
        handler.editable = false;
        assertThat(service.types().get(0).editable()).isFalse();
    }

    @Test
    void templateRefusesAnUnknownFormatAndNamesTheFile() {
        assertThatThrownBy(() -> service.template(clubId, TYPE, "pdf", null)).isInstanceOf(ValidationException.class);
        assertThat(service.template(clubId, TYPE, "csv", null).fileName()).startsWith("fake-template-").endsWith(".csv");
    }

    @Test
    void aiHelpWithNoPromptIsNotFound() {
        assertThatThrownBy(() -> service.aiHelp(clubId, TYPE, null)).isInstanceOf(NotFoundException.class);
    }
}
