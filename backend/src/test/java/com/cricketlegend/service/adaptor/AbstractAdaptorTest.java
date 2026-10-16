package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.cricketlegend.exception.UnsupportedImportFormatException;
import com.cricketlegend.support.ImportedResults;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * docs/specs/104-match-results-import-adaptors.md Test Plan, "AbstractAdaptor defaults, through a minimal test adaptor":
 * the defaults, the strict UTF-8 reader, the format and size checks and the order and guarantees of {@code importFrom}.
 */
class AbstractAdaptorTest {

    private static final byte[] BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    private final ImportedResultDto valid = ImportedResults.builder().build();
    private final TestAdaptor adaptor = TestAdaptor.json(valid);

    // ---- defaults ----

    @Test
    void isSupportedIsMembershipOfTheDeclaredFormats() {
        assertThat(adaptor.isSupported(ImportInputFormat.JSON)).isTrue();
        assertThat(adaptor.isSupported(ImportInputFormat.CSV)).isFalse();
        assertThat(adaptor.isSupported(ImportInputFormat.PDF)).isFalse();
    }

    @Test
    void aiIsNotAllowedAndThereIsNoExampleOrPromptByDefault() {
        assertThat(adaptor.isAiAllowed()).isFalse();
        assertThat(adaptor.getExample()).isNull();
        assertThat(adaptor.getConversionPrompt()).isNull();
    }

    @ParameterizedTest
    @EnumSource(ImportInputFormat.class)
    void maxBytesIsTheFormatDefaultNeverAboveTheGlobalLimit(ImportInputFormat format) {
        assertThat(adaptor.maxBytes(format))
                .isEqualTo(Math.min(format.getDefaultMaxBytes(), ResultImportLimits.GLOBAL_MAX_FILE_BYTES))
                .isLessThanOrEqualTo(ResultImportLimits.GLOBAL_MAX_FILE_BYTES);
    }

    // ---- read ----

    @Test
    void readDecodesUtf8WithoutABom() {
        TextContent content = (TextContent) adaptor.read(file("{\"name\": \"Zoë Ngwenya\"}".getBytes(StandardCharsets.UTF_8)));

        assertThat(content.text()).isEqualTo("{\"name\": \"Zoë Ngwenya\"}");
    }

    @Test
    void readStripsAUtf8ByteOrderMark() {
        byte[] body = "{\"a\": 1}".getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream withBom = new ByteArrayOutputStream();
        withBom.writeBytes(BOM);
        withBom.writeBytes(body);

        TextContent content = (TextContent) adaptor.read(file(withBom.toByteArray()));

        assertThat(content.text()).isEqualTo("{\"a\": 1}").doesNotStartWith("﻿");
    }

    @Test
    void readRejectsBytesThatAreNotValidUtf8() {
        byte[] latin1 = "Zoë".getBytes(StandardCharsets.ISO_8859_1);

        assertThatThrownBy(() -> adaptor.read(file(latin1)))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("UTF-8");
    }

    @Test
    void readOfABinaryFormatWithNoOverrideIsUnsupported() {
        TestAdaptor pdf = new TestAdaptor(AdaptorType.JSON, Set.of(ImportInputFormat.PDF), c -> valid);

        assertThatThrownBy(() -> pdf.read(ImportInput.file(ImportInputFormat.PDF, "a.pdf", new byte[] {1})))
                .isInstanceOf(UnsupportedImportFormatException.class)
                .satisfies(ex -> assertThat(((UnsupportedImportFormatException) ex).getRequested()).isEqualTo("PDF"));
    }

    // ---- importFrom ----

    @Test
    void aFileIsReadValidatedThenTransformedInThatOrder() {
        adaptor.importFrom(file("{}".getBytes(StandardCharsets.UTF_8)));

        assertThat(adaptor.calls).containsExactly("read", "validate", "transform");
    }

    @Test
    void aPasteIsNeverReadButIsStillValidatedAndTransformed() {
        adaptor.importFrom(ImportInput.paste(ImportInputFormat.JSON, "{}"));

        assertThat(adaptor.calls).containsExactly("validate", "transform");
    }

    @Test
    void aFormatTheAdaptorDoesNotSupportIsRefusedListingWhatItAccepts() {
        TestAdaptor multi = new TestAdaptor(AdaptorType.JSON,
                Set.of(ImportInputFormat.JSON, ImportInputFormat.CSV), c -> valid);

        assertThatThrownBy(() -> multi.importFrom(ImportInput.file(ImportInputFormat.EXCEL, "a.xlsx", new byte[] {1})))
                .isInstanceOfSatisfying(UnsupportedImportFormatException.class, ex -> {
                    assertThat(ex.getRequested()).isEqualTo("EXCEL");
                    assertThat(ex.getSupported()).containsExactly("JSON", "CSV");
                    assertThat(ex.getMessage()).contains("Test adaptor", "EXCEL", "JSON, CSV");
                });
        assertThat(multi.calls).isEmpty();
    }

    @Test
    void aPasteOfABinaryFormatIsRefusedEvenWhenTheAdaptorSupportsIt() {
        TestAdaptor pdf = new TestAdaptor(AdaptorType.JSON, Set.of(ImportInputFormat.PDF), c -> valid);

        assertThatThrownBy(() -> pdf.importFrom(ImportInput.paste(ImportInputFormat.PDF, "text")))
                .isInstanceOf(UnsupportedImportFormatException.class);
        assertThat(pdf.calls).isEmpty();
    }

    @Test
    void importFromStampsTheAdaptorAndFileNameAndKeepsTheProvidersIdentity() {
        ImportedResultDto emitted = ImportedResults.builder()
                .source(new ImportedResultDto.Source(null, "EXAMPLE", "match-77", "ignored-name.json"))
                .build();
        TestAdaptor stamping = TestAdaptor.json(emitted);

        ImportedResultDto result = stamping.importFrom(
                ImportInput.file(ImportInputFormat.JSON, "scores.json", "{}".getBytes(StandardCharsets.UTF_8)));

        assertThat(result.source().adaptor()).isEqualTo(AdaptorType.JSON);
        assertThat(result.source().fileName()).isEqualTo("scores.json");
        assertThat(result.source().provider()).isEqualTo("EXAMPLE");
        assertThat(result.source().externalMatchId()).isEqualTo("match-77");
    }

    @Test
    void aPasteHasNoFileName() {
        ImportedResultDto result = adaptor.importFrom(ImportInput.paste(ImportInputFormat.JSON, "{}"));

        assertThat(result.source().fileName()).isNull();
        assertThat(result.source().adaptor()).isEqualTo(AdaptorType.JSON);
    }

    @Test
    void anAdaptorThatEmitsAnInvalidDocumentFailsValidationInsteadOfPassingThrough() {
        ImportedResultDto invalid = ImportedResults.builder().schemaVersion(2).teams(ImportedResults.team("A", "Only One")).build();
        TestAdaptor faulty = TestAdaptor.json(invalid);

        assertThatThrownBy(() -> faulty.importFrom(ImportInput.paste(ImportInputFormat.JSON, "{}")))
                .isInstanceOfSatisfying(ImportInputValidationException.class, ex -> {
                    assertThat(ex.getMessage()).contains("fault in the adaptor");
                    assertThat(ex.getErrors()).extracting(e -> e.code())
                            .contains("UNSUPPORTED_SCHEMA_VERSION", "INVALID_VALUE");
                });
    }

    @Test
    void aFileOverTheFormatLimitIsRefusedBeforeItIsRead() {
        byte[] tooBig = new byte[(int) ResultImportLimits.TEXT_FILE_MAX_BYTES + 1];

        assertThatThrownBy(() -> adaptor.importFrom(ImportInput.file(ImportInputFormat.JSON, "big.json", tooBig)))
                .isInstanceOfSatisfying(ImportInputValidationException.class, ex -> {
                    assertThat(ex.getErrors()).singleElement().satisfies(e -> {
                        assertThat(e.code()).isEqualTo("INPUT_TOO_LARGE");
                        assertThat(e.path()).isEmpty();
                    });
                    assertThat(ex.getMessage()).contains("2 MB");
                });
        assertThat(adaptor.calls).isEmpty();
    }

    @Test
    void aPasteOverTheCharacterLimitIsRefused() {
        String tooLong = "x".repeat(ResultImportLimits.MAX_PASTE_CHARACTERS + 1);

        assertThatThrownBy(() -> adaptor.importFrom(ImportInput.paste(ImportInputFormat.JSON, tooLong)))
                .isInstanceOfSatisfying(ImportInputValidationException.class,
                        ex -> assertThat(ex.getErrors()).extracting(e -> e.code()).containsExactly("INPUT_TOO_LARGE"));
    }

    @Test
    void aPasteExactlyAtTheLimitIsAccepted() {
        String atLimit = "x".repeat(ResultImportLimits.MAX_PASTE_CHARACTERS);

        assertThat(adaptor.importFrom(ImportInput.paste(ImportInputFormat.JSON, atLimit))).isNotNull();
    }

    private static ImportInput file(byte[] bytes) {
        return ImportInput.file(ImportInputFormat.JSON, "scores.json", bytes);
    }
}
