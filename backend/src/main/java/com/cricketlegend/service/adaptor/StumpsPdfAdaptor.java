package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportedResultDto;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md: the adaptor for a STUMPS match report, uploaded as a PDF (a PDF
 * cannot be pasted). {@link StumpsPdfText} reads the text of the PDF into numbered lines and {@link StumpsReportParser}
 * turns them into the common document; no AI and no network. The provider is {@code STUMPS} and the report's own match id
 * is the {@code externalMatchId}, so importing the same report again finds the draft it made. The ball-by-ball pages
 * of the report are ignored. No file content is kept.
 */
@Component
public class StumpsPdfAdaptor extends AbstractAdaptor {

    private static final long serialVersionUID = 1L;

    public StumpsPdfAdaptor() {
        super(AdaptorType.STUMPS_PDF);
    }

    @Override
    public String getDisplayName() {
        return "STUMPS match report (PDF)";
    }

    @Override
    public String getDescription() {
        return "The PDF match report exported from the STUMPS scoring app, uploaded as a file. The toss, venue, start time"
                + " and match id are read from it as well as the scorecard.";
    }

    @Override
    public Set<ImportInputFormat> getSupportedFormats() {
        return Set.of(ImportInputFormat.PDF);
    }

    /** The text of the PDF as numbered lines; a file that is not a readable PDF, has no text or is too long is refused. */
    @Override
    public AdaptorContent read(ImportInput input) {
        if (input.format() != ImportInputFormat.PDF) {
            return super.read(input);
        }
        return new StumpsContent(StumpsPdfText.extract(input.bytes()));
    }

    @Override
    public void validate(AdaptorContent content) {
        StumpsReportParser.requireStumpsReport(lines(content));
    }

    @Override
    public ImportedResultDto transform(AdaptorContent content, AdaptorContext context) {
        return StumpsReportParser.parse(lines(content));
    }

    private static List<StumpsLines.Line> lines(AdaptorContent content) {
        return ((StumpsContent) content).lines();
    }
}
