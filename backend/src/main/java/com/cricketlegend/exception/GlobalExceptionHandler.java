package com.cricketlegend.exception;

import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Central mapping from the fixed business exception set to HTTP responses — see
 * docs/standards/backend.md's exception matrix.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail handleNotFound(NotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(ConflictException.class)
    ProblemDetail handleConflict(ConflictException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    /**
     * docs/specs/076-team-selection.md: a refused apply-selection request carries the per-player
     * rejections as a {@code rejections} property. The more specific type wins over the generic
     * {@link ConflictException} handler above.
     */
    @ExceptionHandler(SelectionRejectedException.class)
    ProblemDetail handleSelectionRejected(SelectionRejectedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setProperty("rejections", ex.getRejections());
        return problem;
    }

    /**
     * docs/specs/099-fields-directory.md: an exact duplicate field carries the existing record's id as an {@code
     * existingPlayingAreaId} property, so the form can offer it. Wins over the generic {@link ConflictException} handler.
     */
    @ExceptionHandler(DuplicateFieldException.class)
    ProblemDetail handleDuplicateField(DuplicateFieldException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setProperty("existingPlayingAreaId", ex.getExistingPlayingAreaId());
        return problem;
    }

    /**
     * docs/specs/104-match-results-import-adaptors.md: the provider id is already on another match; carries {@code
     * otherMatchId}. Wins over the generic {@link ConflictException} handler.
     */
    @ExceptionHandler(ImportExternalIdAlreadyUsedException.class)
    ProblemDetail handleImportExternalIdAlreadyUsed(ImportExternalIdAlreadyUsedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setProperty("otherMatchId", ex.getOtherMatchId());
        return problem;
    }

    /** 077: the single generic verify failure, with the tries left on the key. */
    @ExceptionHandler(PublicVerificationFailedException.class)
    ProblemDetail handlePublicVerificationFailed(PublicVerificationFailedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, ex.getMessage());
        problem.setProperty("triesLeft", ex.getTriesLeft());
        return problem;
    }

    @ExceptionHandler(PublicVerificationLockedException.class)
    ProblemDetail handlePublicVerificationLocked(PublicVerificationLockedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.LOCKED, ex.getMessage());
        problem.setProperty("retryAfterSeconds", ex.getRetryAfterSeconds());
        return problem;
    }

    @ExceptionHandler(PublicRateLimitedException.class)
    ProblemDetail handlePublicRateLimited(PublicRateLimitedException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage());
        problem.setProperty("retryAfterSeconds", ex.getRetryAfterSeconds());
        return problem;
    }

    @ExceptionHandler(InvalidPublicTokenException.class)
    ProblemDetail handleInvalidPublicToken(InvalidPublicTokenException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(ValidationException.class)
    ProblemDetail handleValidation(ValidationException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    /**
     * docs/specs/100-match-results-core.md: an invalid result carries its {@code errors}, {@code warnings} and (docs/specs/101) typed {@code issues} as
     * properties so the wizard can list them. Wins over the generic {@link ValidationException} handler.
     */
    @ExceptionHandler(InvalidResultException.class)
    ProblemDetail handleInvalidResult(InvalidResultException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setProperty("errors", ex.getErrors());
        problem.setProperty("warnings", ex.getWarnings());
        problem.setProperty("issues", ex.getIssues());
        return problem;
    }

    /**
     * docs/specs/104-match-results-import-adaptors.md: an unusable import input carries {@code errors} (with {@code
     * totalErrors}) for a document that is readable but wrong, or {@code supported} formats for an unsupported one.
     * Wins over the generic {@link ValidationException} handler.
     */
    @ExceptionHandler(InvalidImportInputException.class)
    ProblemDetail handleInvalidImportInput(InvalidImportInputException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        if (ex instanceof ImportInputValidationException validation) {
            problem.setProperty("errors", validation.getErrors());
            problem.setProperty("totalErrors", validation.getTotalErrors());
        } else if (ex instanceof UnsupportedImportFormatException unsupported) {
            problem.setProperty("supported", unsupported.getSupported());
        }
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleBeanValidation(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
    }

    /**
     * Defense-in-depth for unique-constraint races (TOCTOU) across any entity — a pre-check like
     * {@code existsByCodeIgnoreCase} narrows the window but can't close it under concurrency, so
     * this is the safety net that turns the resulting {@code DataIntegrityViolationException} into
     * a 409 instead of an unhandled 500. Generic on purpose: this handler is app-wide, not specific
     * to any one entity, so it doesn't guess which column/constraint was violated.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT, "A conflicting record already exists");
    }
}
