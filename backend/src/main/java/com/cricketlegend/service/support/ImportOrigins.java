package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportOrigin;
import com.cricketlegend.dto.ImportedResultDto;
import java.util.Locale;

/**
 * docs/specs/104-match-results-import-adaptors.md: the idempotency key of an import. The source is {@code
 * IMPORT:<PROVIDER>} (upper case, provider at most 40 characters); a file with no provider falls back to its adaptor
 * type. The external id is the provider's match id, or null when the file has none.
 */
public final class ImportOrigins {

    public static final String PREFIX = "IMPORT:";
    private static final int MAX_PROVIDER = 40;

    private ImportOrigins() {}

    public static ImportOrigin of(ImportedResultDto document) {
        ImportedResultDto.Source source = document.source();
        String provider = source == null || source.provider() == null || source.provider().isBlank()
                ? (source != null && source.adaptor() != null ? source.adaptor().name() : "UNKNOWN")
                : source.provider().trim();
        provider = provider.toUpperCase(Locale.ROOT);
        if (provider.length() > MAX_PROVIDER) {
            provider = provider.substring(0, MAX_PROVIDER);
        }
        String externalId = source == null || source.externalMatchId() == null || source.externalMatchId().isBlank()
                ? null
                : source.externalMatchId().trim();
        return new ImportOrigin(PREFIX + provider, externalId);
    }
}
