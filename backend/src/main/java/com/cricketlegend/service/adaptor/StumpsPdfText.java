package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.cricketlegend.service.adaptor.StumpsLines.Line;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md, "Backend design": the only class that touches PDFBox
 * ({@code ImportAdaptorRulesTest} proves it). Loads the uploaded bytes and returns the text of each page in the
 * library's default reading order as numbered lines. It runs no JavaScript, opens no embedded file and uses no network;
 * it refuses a file that is not a readable PDF, one with more than {@link #MAX_PAGES} pages (a report is about seven) and
 * one with no text at all (a scan). It never logs the text, and no message quotes it.
 */
final class StumpsPdfText {

    /** A report is about seven pages; more than this is refused before any text is read. */
    static final int MAX_PAGES = 30;

    private StumpsPdfText() {}

    /** The numbered lines of the PDF, or the reason it cannot be read. */
    static List<Line> extract(byte[] bytes) {
        try (PDDocument document = Loader.loadPDF(bytes)) {
            if (document.isEncrypted()) {
                throw new UnreadableImportInputException("The PDF is protected and cannot be read. Export the report"
                        + " again without a password.");
            }
            int pages = document.getNumberOfPages();
            if (pages > MAX_PAGES) {
                throw new ImportInputValidationException("The PDF is longer than a STUMPS match report.",
                        List.of(new ImportErrorDto("", "TOO_MANY_PAGES", "The PDF has " + pages + " pages. A STUMPS match"
                                + " report has about seven, and this adaptor reads at most " + MAX_PAGES + ".")));
            }
            PDFTextStripper stripper = new PDFTextStripper();
            List<String> texts = new ArrayList<>(pages);
            for (int page = 1; page <= pages; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                texts.add(stripper.getText(document));
            }
            List<Line> lines = StumpsLines.ofPages(texts);
            if (lines.isEmpty()) {
                throw new ImportInputValidationException("The PDF has no text this adaptor can read.",
                        List.of(new ImportErrorDto("", "NO_TEXT_IN_PDF", "The PDF has no text in it. A scanned or"
                                + " photographed report cannot be read; export the report from the STUMPS app as a PDF.")));
            }
            return lines;
        } catch (ImportInputValidationException | UnreadableImportInputException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            // the message of a PDF library error can quote the file, so it is not passed on
            throw new UnreadableImportInputException("The file is not a PDF that can be read. It may be damaged, or it"
                    + " may not be a PDF at all.");
        }
    }
}
