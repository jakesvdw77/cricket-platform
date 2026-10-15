package com.cricketlegend.service.adaptor;

/**
 * docs/specs/104-match-results-import-adaptors.md: the per-import options handed to {@code transform}. Options only;
 * there is no AI facade in this revision.
 */
public record AdaptorContext(ImportInputFormat format, String fileName) {

    public static AdaptorContext of(ImportInput input) {
        return new AdaptorContext(input.format(), input.fileName());
    }
}
