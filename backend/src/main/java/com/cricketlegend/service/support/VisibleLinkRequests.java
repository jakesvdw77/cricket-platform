package com.cricketlegend.service.support;

import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.service.support.LinkRequestSuggester.Suggestion;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** The waiting link requests a caller may see and decide, with the suggestion found for each (docs/specs/119). */
public record VisibleLinkRequests(List<LinkRequest> requests, Map<UUID, Suggestion> suggestions) {}
