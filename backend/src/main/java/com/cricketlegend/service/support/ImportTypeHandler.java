package com.cricketlegend.service.support;

import com.cricketlegend.domain.ImportBatch;
import com.cricketlegend.dto.DeletionCheckDto;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportTypeDto;
import com.cricketlegend.dto.PlannedChangeDto;
import com.cricketlegend.dto.ReferenceProposalDto;
import com.cricketlegend.domain.ImportTemplateScope;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.Authentication;

/**
 * The extension point of the import framework (docs/specs/097-import-framework.md): one Spring bean per import type.
 * A new import is a handler, a template and a prompt resource, not a new wizard or batch model.
 *
 * <p>Rules (docs/standards/backend.md, "Import framework (spec 097)"):
 * <ul>
 *   <li>Only {@code ImportServiceImpl} calls a handler (ArchUnit). {@code ImportHandlerRegistry} merely holds the beans.
 *   <li>{@link #commit} and {@link #delete} write only through the existing services, never through repositories, so
 *       every business rule of the normal create path applies.
 *   <li>Row values are JSON-simple; a handler must not depend on the status, outcome or action of an incoming row (the
 *       framework replays stored rows through {@link #validate} on every decision and again at commit).
 *   <li>Nothing a handler logs or throws may contain file content or row values.
 * </ul>
 *
 * <p>Two members beyond the spec's list are needed by the framework and are part of this contract: {@link #label()} (the
 * types list) and {@link #scopeKey(ImportScope)} (stored on the batch for history, the advisory lock and identity).
 * {@link #aiPrompt} returns only the scope-specific appendix (for example this league's team names); the versioned
 * prompt text itself is the classpath resource {@code imports/prompts/<type>/v<templateVersion>.md}.
 */
public interface ImportTypeHandler {

    /** Stable type code, for example {@code LEAGUE_SCHEDULE}. */
    String type();

    /** Plain-English name for the UI. */
    String label();

    int templateVersion();

    /** Whether the type has an "ours" notion and so offers the scope option (principle 7). */
    boolean supportsOursScope();

    /** Stable key of the scope, for example {@code league:<id>|season:<id>}; throws a 400/404 for a bad scope. */
    String scopeKey(ImportScope scope);

    /**
     * The columns the wizard may edit (spec 125); an empty list, the default, means the type is not editable. Keys are
     * the row value keys the handler's {@link #validate} reads.
     */
    default List<ImportTypeDto.EditableColumn> editableColumns() {
        return List.of();
    }

    byte[] buildTemplate(ImportScope scope, ImportTemplateScope templateScope, TemplateFormat format);

    /** Scope-specific text appended to the versioned prompt, or empty. Never personal data. */
    String aiPrompt(ImportScope scope);

    /** Reads a file into normalised rows; file-level problems throw {@code ImportFileRejectedException}. */
    ParsedImport parse(ImportFile file, ImportScope scope, ImportOptions options);

    /** Runs every deterministic rule, including record identity against live data, with the decisions applied. */
    ValidationResult validate(ParsedImport parsed, ImportScope scope, ImportDecisionsDto decisions);

    List<ReferenceProposalDto> propose(ParsedImport parsed, ImportScope scope);

    /** The type's definition of "the same record", over resolved references (principle 8). */
    Object identityKey(ResolvedRow row);

    /** Existing records with these identity keys in this scope, whoever created them. */
    ExistingMatches findExisting(ImportScope scope, Collection<Object> keys);

    /**
     * The creations and opt-in updates the commit would make; deterministic for the same effective import. A
     * {@code RowUpdate} with an empty {@code attributes} list means ALL the attributes this type allows to be updated
     * for that row.
     */
    List<PlannedChangeDto> plannedChanges(EffectiveImport effective);

    CommitOutcome commit(Authentication auth, EffectiveImport effective);

    DeletionCheckDto checkDeletion(ImportBatch batch);

    /** Guarded, all or nothing; throws {@code ImportDeletionBlockedException} when something depends on the records. */
    void delete(Authentication auth, ImportBatch batch);
}
