package com.cricketlegend.service.adaptor;

import java.util.List;

/**
 * docs/specs/108-match-results-stumps-pdf-adaptor.md: the working form of a STUMPS PDF, the numbered lines of its text
 * (see {@link StumpsLines}). Produced by {@code StumpsPdfAdaptor.read}, consumed by {@code validate} and {@code transform}.
 */
record StumpsContent(List<StumpsLines.Line> lines) implements AdaptorContent {
}
