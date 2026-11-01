package com.cricketlegend.service.support;

import com.cricketlegend.domain.LiveScoreKind;
import com.cricketlegend.domain.MatchPhase;
import com.cricketlegend.dto.LiveScoreSource;
import java.net.URI;

/**
 * docs/specs/135, the LiveScore seam: the one place a live-score source is built. Today it is EXTERNAL, from the match's
 * scoring link (https only); the later in-app scorecard adds a NATIVE source here and nothing else changes. The source
 * is present while a match is live or upcoming and null otherwise. Pure.
 */
public final class LiveScoreResolver {

    private LiveScoreResolver() {}

    public static LiveScoreSource resolve(String scoringUrl, MatchPhase phase) {
        if (phase == MatchPhase.RECENT) {
            return null;
        }
        URI uri = HttpsLink.parse(scoringUrl);
        return uri == null ? null : new LiveScoreSource(LiveScoreKind.EXTERNAL, uri.toString(), HttpsLink.host(uri));
    }
}
