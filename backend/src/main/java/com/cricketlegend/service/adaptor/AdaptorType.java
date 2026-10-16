package com.cricketlegend.service.adaptor;

/**
 * docs/specs/104-match-results-import-adaptors.md: the registered import adaptors. {@code JSON} now; the STUMPS PDF and
 * CricClubs CSV adaptors are named in their own specs. Each constant has exactly one {@link Adaptor} bean and one
 * {@code @JsonSubTypes} entry on {@link AbstractAdaptor}.
 */
public enum AdaptorType {
    JSON
}
