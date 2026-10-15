package com.cricketlegend.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.ImportErrorDto;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.method.annotation.ExceptionHandlerMethodResolver;

/**
 * docs/specs/104-match-results-import-adaptors.md Test Plan: the import exception hierarchy and how
 * {@code GlobalExceptionHandler} maps it (400 with {@code errors}, {@code totalErrors} and {@code supported}; 409 with
 * {@code otherMatchId}). Handlers are picked by Spring's own resolver, so the test also proves the specific handler wins
 * over the generic {@code ValidationException} / {@code ConflictException} one.
 */
class ImportExceptionsTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final ExceptionHandlerMethodResolver resolver = new ExceptionHandlerMethodResolver(GlobalExceptionHandler.class);

    private ProblemDetail handle(Exception ex) throws Exception {
        Method method = resolver.resolveMethodByThrowable(ex);
        assertThat(method).as("a handler for " + ex.getClass().getSimpleName()).isNotNull();
        method.setAccessible(true);
        return (ProblemDetail) method.invoke(handler, ex);
    }

    private static List<ImportErrorDto> errors(int count) {
        return IntStream.range(0, count).mapToObj(i -> new ImportErrorDto("innings[" + i + "]", "INVALID_VALUE", "m" + i)).toList();
    }

    // ---- hierarchy ----

    @Test
    void theInputExceptionsAreValidationExceptionsAndTheConflictsAreConflictExceptions() {
        assertThat(new UnreadableImportInputException("x")).isInstanceOf(InvalidImportInputException.class)
                .isInstanceOf(ValidationException.class);
        assertThat(new UnsupportedImportFormatException("PDF", List.of("JSON"), "x")).isInstanceOf(InvalidImportInputException.class);
        assertThat(new ImportInputValidationException("x", List.of())).isInstanceOf(InvalidImportInputException.class);
        assertThat(new ImportMatchAlreadyHasResultException("x")).isInstanceOf(ConflictException.class);
        assertThat(new ImportWouldOverwriteDraftException("x")).isInstanceOf(ConflictException.class);
        assertThat(new ImportExternalIdAlreadyUsedException("x", UUID.randomUUID())).isInstanceOf(ConflictException.class);
    }

    // ---- ImportInputValidationException ----

    @Test
    void validationExceptionCapsTheErrorsAtFiftyAndKeepsTheTotal() {
        ImportInputValidationException ex = new ImportInputValidationException("bad", errors(73));

        assertThat(ex.getErrors()).hasSize(ImportInputValidationException.MAX_ERRORS).hasSize(50);
        assertThat(ex.getErrors().get(0).message()).isEqualTo("m0");
        assertThat(ex.getErrors().get(49).message()).isEqualTo("m49");
        assertThat(ex.getTotalErrors()).isEqualTo(73);
    }

    @Test
    void validationExceptionWithFewErrorsKeepsThemAll() {
        ImportInputValidationException ex = new ImportInputValidationException("bad", errors(3));

        assertThat(ex.getErrors()).hasSize(3);
        assertThat(ex.getTotalErrors()).isEqualTo(3);
    }

    @Test
    void validationExceptionCopiesItsListSoLaterChangesDoNotLeakIn() {
        List<ImportErrorDto> source = new ArrayList<>(errors(2));
        ImportInputValidationException ex = new ImportInputValidationException("bad", source);
        source.clear();

        assertThat(ex.getErrors()).hasSize(2);
    }

    // ---- GlobalExceptionHandler ----

    @Test
    void validationFailureIs400WithErrorsAndTotal() throws Exception {
        ProblemDetail problem = handle(new ImportInputValidationException("The JSON does not follow the format.", errors(60)));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(problem.getDetail()).isEqualTo("The JSON does not follow the format.");
        assertThat(problem.getProperties()).containsKeys("errors", "totalErrors");
        assertThat((List<?>) problem.getProperties().get("errors")).hasSize(50);
        assertThat(problem.getProperties().get("totalErrors")).isEqualTo(60);
        assertThat(problem.getProperties()).doesNotContainKey("supported");
    }

    @Test
    void unsupportedFormatIs400WithTheSupportedFormats() throws Exception {
        ProblemDetail problem = handle(new UnsupportedImportFormatException("PDF", List.of("CSV", "JSON"), "Not that one."));

        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getDetail()).isEqualTo("Not that one.");
        assertThat(problem.getProperties()).containsEntry("supported", List.of("CSV", "JSON"));
        assertThat(problem.getProperties()).doesNotContainKeys("errors", "totalErrors");
    }

    @Test
    void unreadableInputIs400WithNoExtraProperties() throws Exception {
        ProblemDetail problem = handle(new UnreadableImportInputException("The text is not valid JSON (line 3, column 7)."));

        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getDetail()).contains("line 3, column 7");
        assertThat(problem.getProperties()).isNullOrEmpty();
    }

    @Test
    void externalIdAlreadyUsedIs409WithTheOtherMatch() throws Exception {
        UUID other = UUID.randomUUID();

        ProblemDetail problem = handle(new ImportExternalIdAlreadyUsedException("Already imported.", other));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(problem.getProperties()).containsEntry("otherMatchId", other);
    }

    @Test
    void theOtherImportConflictsAre409WithNoExtraProperties() throws Exception {
        for (ConflictException ex : List.of(
                new ImportMatchAlreadyHasResultException("published"), new ImportWouldOverwriteDraftException("draft"))) {
            ProblemDetail problem = handle(ex);

            assertThat(problem.getStatus()).isEqualTo(409);
            assertThat(problem.getDetail()).isEqualTo(ex.getMessage());
            assertThat(problem.getProperties()).isNullOrEmpty();
        }
    }
}
