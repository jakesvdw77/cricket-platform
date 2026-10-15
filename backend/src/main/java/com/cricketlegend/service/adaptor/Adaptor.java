package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportedResultDto;
import java.util.Set;

/**
 * docs/specs/104-match-results-import-adaptors.md: turns one kind of input into the common import document. Adaptors are
 * stateless Spring beans found by {@link AdaptorRegistry}; they never touch a repository or a result service. Extend
 * {@link AbstractAdaptor} rather than implementing this directly.
 */
public interface Adaptor {

    AdaptorType getType();

    String getDisplayName();

    String getDescription();

    Set<ImportInputFormat> getSupportedFormats();

    boolean isSupported(ImportInputFormat format);

    /** A declaration for a later AI tier; nothing in this revision sets it or reads it. */
    boolean isAiAllowed();

    /** A short sample input for a text format so the UI can offer "Insert example", or null. */
    String getExample();

    /**
     * Plain-English text a manager copies into their own AI chat together with their scorecard, asking for a document in
     * this adaptor's format, or null. The platform sends it nowhere.
     */
    String getConversionPrompt();

    /** The largest upload this adaptor accepts for the format, never above the global multipart limit. */
    long maxBytes(ImportInputFormat format);

    /** Reads an uploaded file into this adaptor's working form. */
    AdaptorContent read(ImportInput input);

    /** Confirms the content is correct for this adaptor; throws {@code ImportInputValidationException} if not. */
    void validate(AdaptorContent content);

    ImportedResultDto transform(AdaptorContent content, AdaptorContext context);

    /** The whole import: check, read, validate, transform, stamp the source, validate the document. */
    ImportedResultDto importFrom(ImportInput input);
}
