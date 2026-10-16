package com.cricketlegend.service;

import com.cricketlegend.dto.AdaptorCatalogueDto;
import com.cricketlegend.dto.ImportPreviewDto;
import com.cricketlegend.dto.ImportPreviewRequest;
import com.cricketlegend.dto.ImportResolveDto;
import com.cricketlegend.dto.ImportResolveRequest;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/104-match-results-import-adaptors.md: result import. {@link #preview} reads and writes nothing; {@link
 * #resolve} is the only write, saves one DRAFT result for a match the manager chose and never publishes.
 */
public interface ResultImportService {

    /** The registered adaptors and the import limits. Reads no data of the club. */
    AdaptorCatalogueDto listAdaptors();

    /**
     * Runs the chosen adaptor over a file ({@code bytes}, with its {@code fileName}) or the pasted {@code content} of the
     * request (exactly one), then proposes the matches in the club's fixtures it could belong to and, for the match the
     * import was launched from or the strongest candidate, the side of each file team. Writes nothing.
     */
    ImportPreviewDto preview(
            Authentication authentication, UUID clubId, ImportPreviewRequest request, String fileName, byte[] bytes);

    /**
     * The explicit confirm: re-validates the document, requires the confirmed match and team mapping, refuses a match
     * with a published result and a draft that is not acknowledged as replaceable, resolves the names, saves the draft
     * and returns what the manager should check. Never creates a person or profile, never publishes.
     */
    ImportResolveDto resolve(Authentication authentication, UUID clubId, ImportResolveRequest request);
}
