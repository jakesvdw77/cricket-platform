package com.cricketlegend.service.adaptor;

import static com.cricketlegend.support.StumpsPdfFixtures.blankPdf;
import static com.cricketlegend.support.StumpsPdfFixtures.encryptedPdf;
import static com.cricketlegend.support.StumpsPdfFixtures.nonBlankLines;
import static com.cricketlegend.support.StumpsPdfFixtures.pdf;
import static com.cricketlegend.support.StumpsPdfFixtures.pdfOfPages;
import static com.cricketlegend.support.StumpsPdfFixtures.text;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.cricketlegend.service.adaptor.StumpsLines.Line;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md Test Plan, "PDF tests": the text helper round-trips a generated
 * PDF into numbered lines per page, and a PDF with no text, one over the page cap, a corrupt PDF and a file that is not a
 * PDF are each refused with a clear message. PDFs are built by {@code StumpsPdfFixtures} from invented text only.
 */
class StumpsPdfTextTest {

    @Test
    void aGeneratedPdfRoundTripsIntoItsLinesInReadingOrder() {
        List<Line> lines = StumpsPdfText.extract(pdf());

        assertThat(lines).extracting(Line::text).containsExactlyElementsOf(nonBlankLines(text()));
    }

    @Test
    void everyLineKnowsItsPageAndItsLineNumberOnThePage() {
        List<Line> lines = StumpsPdfText.extract(pdf("first page line one\nfirst page line two\fsecond page line one\nsecond page line two"));

        assertThat(lines).extracting(Line::page, Line::number, Line::text).containsExactly(
                org.assertj.core.groups.Tuple.tuple(1, 1, "first page line one"),
                org.assertj.core.groups.Tuple.tuple(1, 2, "first page line two"),
                org.assertj.core.groups.Tuple.tuple(2, 1, "second page line one"),
                org.assertj.core.groups.Tuple.tuple(2, 2, "second page line two"));
        assertThat(lines.get(3).path()).isEqualTo("page 2, line 2");
    }

    @Test
    void aPdfOfExactlyThePageCapIsRead() {
        assertThat(StumpsPdfText.extract(pdfOfPages(StumpsPdfText.MAX_PAGES))).hasSize(StumpsPdfText.MAX_PAGES);
    }

    @Test
    void aPdfOverThePageCapIsRefusedBeforeItsTextIsRead() {
        assertThatThrownBy(() -> StumpsPdfText.extract(pdfOfPages(StumpsPdfText.MAX_PAGES + 1)))
                .isInstanceOfSatisfying(ImportInputValidationException.class, ex -> {
                    assertThat(ex.getErrors()).extracting(ImportErrorDto::code).containsExactly("TOO_MANY_PAGES");
                    assertThat(ex.getErrors().get(0).message()).contains("31 pages").contains("at most 30");
                });
    }

    @Test
    void aPdfWithNoTextIsRefusedAsAScan() {
        assertThatThrownBy(() -> StumpsPdfText.extract(blankPdf(3)))
                .isInstanceOfSatisfying(ImportInputValidationException.class, ex -> {
                    assertThat(ex.getErrors()).extracting(ImportErrorDto::code).containsExactly("NO_TEXT_IN_PDF");
                    assertThat(ex.getErrors().get(0).message()).contains("scanned");
                    assertThat(ex.getErrors().get(0).path()).isEmpty();
                });
    }

    @Test
    void aPdfWithNoPagesAtAllHasNoText() {
        assertThatThrownBy(() -> StumpsPdfText.extract(blankPdf(0)))
                .isInstanceOfSatisfying(ImportInputValidationException.class,
                        ex -> assertThat(ex.getErrors().get(0).code()).isEqualTo("NO_TEXT_IN_PDF"));
    }

    @Test
    void aCorruptPdfIsRefusedWithAPlainMessage() {
        byte[] good = pdf();
        byte[] corrupt = Arrays.copyOf(good, good.length);
        // the header survives, the body does not: the cross reference table and the objects are noise
        for (int i = 20; i < corrupt.length; i++) {
            corrupt[i] = (byte) (i * 31);
        }

        assertThatThrownBy(() -> StumpsPdfText.extract(corrupt))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("not a PDF that can be read");
    }

    @Test
    void aFileThatIsNotAPdfIsRefusedWithAPlainMessage() {
        byte[] notPdf = "Match report created from STUMPS, but this is a text file.".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> StumpsPdfText.extract(notPdf))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("not a PDF that can be read");
    }

    @Test
    void anEmptyFileIsRefusedWithAPlainMessage() {
        assertThatThrownBy(() -> StumpsPdfText.extract(new byte[0])).isInstanceOf(UnreadableImportInputException.class);
    }

    @Test
    void aPdfThatNeedsAPasswordIsRefusedAsProtectedNotAsDamaged() {
        byte[] locked = encryptedPdf(text(), "user-secret-1");

        assertThatThrownBy(() -> StumpsPdfText.extract(locked))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("protected")
                .hasMessageContaining("without a password")
                .message().doesNotContain("damaged");
    }

    @Test
    void aPdfEncryptedWithAnEmptyUserPasswordOpensButIsStillRefusedAsProtected() {
        byte[] encrypted = encryptedPdf(text(), "");

        assertThatThrownBy(() -> StumpsPdfText.extract(encrypted))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("protected")
                .message().doesNotContain("damaged");
    }
}
