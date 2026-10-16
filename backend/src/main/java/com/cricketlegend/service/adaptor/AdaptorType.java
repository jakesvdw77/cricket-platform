package com.cricketlegend.service.adaptor;

/**
 * docs/specs/104-match-results-import-adaptors.md: the registered import adaptors. {@code JSON} and, from docs/specs/107,
 * {@code CRICCLUBS_CSV}; the STUMPS PDF adaptor is named in its own spec. Each constant has exactly one
 * {@link Adaptor} bean and one {@code @JsonSubTypes} entry on {@link AbstractAdaptor}.
 */
public enum AdaptorType {
    JSON,
    CRICCLUBS_CSV
}
