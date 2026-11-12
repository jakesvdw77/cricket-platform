package com.cricketlegend.service.support;

import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * docs/specs/147 AMENDMENT (owner, 2026-11-07): the one place that decides whether a Player Hub read may show one player
 * ranked against others (the Leaderboards standing, "Where Sam stands", the within-team rank). Today every club allows
 * it, because the owner is taking legal advice on children in rankings and wants to see the cards; a club switch, an age
 * rule or a legal restriction is added here later without touching a card or a read. Every ranking field of the Hub
 * payloads is filled only when this answers true.
 */
@Component
public class HubRankingPolicy {

    public boolean allowsRankings(UUID clubId) {
        return true;
    }
}
