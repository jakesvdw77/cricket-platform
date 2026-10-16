package com.cricketlegend.service.adaptor;

import static com.cricketlegend.support.StumpsPdfFixtures.blankPdf;
import static com.cricketlegend.support.StumpsPdfFixtures.pdf;
import static com.cricketlegend.support.StumpsPdfFixtures.text;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.cricketlegend.exception.UnsupportedImportFormatException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md Test Plan, "PDF tests" and "Architecture and contract": what the
 * adaptor declares (PDF only, no paste, no AI, no prompt, no example), the whole import from PDF bytes to a validated
 * common document with the source stamped, and the refusals a manager sees. Invented, masked reports only.
 */
class StumpsPdfAdaptorTest {

    private final StumpsPdfAdaptor adaptor = new StumpsPdfAdaptor();

    private ImportedResultDto importPdf(byte[] bytes) {
        return adaptor.importFrom(ImportInput.file(ImportInputFormat.PDF, "report.pdf", bytes));
    }

    @Test
    void itIsDeclaredAsAPdfOnlyAdaptorWithNoAiNoPromptAndNoExample() {
        assertThat(adaptor.getType()).isEqualTo(AdaptorType.STUMPS_PDF);
        assertThat(adaptor.getDisplayName()).isEqualTo("STUMPS match report (PDF)");
        assertThat(adaptor.getSupportedFormats()).containsExactly(ImportInputFormat.PDF);
        assertThat(adaptor.isSupported(ImportInputFormat.PDF)).isTrue();
        assertThat(adaptor.isSupported(ImportInputFormat.CSV)).isFalse();
        assertThat(adaptor.isAiAllowed()).isFalse();
        assertThat(adaptor.getConversionPrompt()).isNull();
        assertThat(adaptor.getExample()).isNull();
        assertThat(adaptor.maxBytes(ImportInputFormat.PDF)).isEqualTo(ImportInputFormat.PDF.getDefaultMaxBytes());
    }

    @Test
    void aPdfBecomesAValidatedDocumentWithTheSourceStamped() {
        ImportedResultDto doc = importPdf(pdf());

        assertThat(doc.source().adaptor()).isEqualTo(AdaptorType.STUMPS_PDF);
        assertThat(doc.source().provider()).isEqualTo("STUMPS");
        assertThat(doc.source().externalMatchId()).isEqualTo("tst00001");
        assertThat(doc.source().fileName()).isEqualTo("report.pdf");
        assertThat(doc.teams()).extracting(ImportedResultDto.Team::name).containsExactly("Team A U15", "Team B U15");
        assertThat(doc.innings()).hasSize(2);
        assertThat(doc.innings().get(0).batting()).hasSize(8);
        assertThat(doc.innings().get(1).batting()).hasSize(6);
    }

    @Test
    void aPdfCannotBePasted() {
        assertThatThrownBy(() -> adaptor.importFrom(ImportInput.paste(ImportInputFormat.PDF, text())))
                .isInstanceOf(UnsupportedImportFormatException.class);
    }

    @Test
    void aCsvIsNotAccepted() {
        assertThatThrownBy(() -> adaptor.importFrom(
                ImportInput.file(ImportInputFormat.CSV, "report.csv", "a,b".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(UnsupportedImportFormatException.class);
    }

    @Test
    void aPdfThatIsNotAStumpsReportIsRefusedWithNotAStumpsReport() {
        byte[] other = pdf("Some other document\nwith a few lines of text\fand a second page");

        assertThatThrownBy(() -> importPdf(other)).isInstanceOfSatisfying(ImportInputValidationException.class,
                ex -> assertThat(ex.getErrors()).extracting(ImportErrorDto::code).containsExactly("NOT_A_STUMPS_REPORT"));
    }

    @Test
    void aPdfWithNoTextIsRefused() {
        assertThatThrownBy(() -> importPdf(blankPdf(2))).isInstanceOfSatisfying(ImportInputValidationException.class,
                ex -> assertThat(ex.getErrors()).extracting(ImportErrorDto::code).containsExactly("NO_TEXT_IN_PDF"));
    }

    @Test
    void aFileThatIsNotAPdfIsRefused() {
        assertThatThrownBy(() -> importPdf("plain text".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(UnreadableImportInputException.class);
    }

    @Test
    void aReportWithAnUnknownDismissalIsRefusedWithItsPageAndLine() {
        byte[] bytes = pdf(text().replace("lbw Player 14", "st Player 3 b Player 16"));

        assertThatThrownBy(() -> importPdf(bytes)).isInstanceOfSatisfying(ImportInputValidationException.class, ex -> {
            assertThat(ex.getErrors()).hasSize(1);
            assertThat(ex.getErrors().get(0).code()).isEqualTo("UNKNOWN_DISMISSAL");
            assertThat(ex.getErrors().get(0).path()).matches("page \\d+, line \\d+");
        });
    }

    @Test
    void theAdaptorTypeRoundTripsThroughJackson() throws Exception {
        ObjectMapper json = new ObjectMapper();

        AbstractAdaptor read = json.readValue("{\"type\":\"STUMPS_PDF\"}", AbstractAdaptor.class);

        assertThat(read).isInstanceOf(StumpsPdfAdaptor.class);
        assertThat(read.getType()).isEqualTo(AdaptorType.STUMPS_PDF);
    }
}
