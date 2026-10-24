package com.cricketlegend.service;

import java.util.UUID;

/**
 * Tells a requester the outcome of their link request by email (docs/specs/119, Decisions 10 and 13). The email is an
 * addition: the in-app status is the source of truth, so a failure here is logged and never undoes a decision.
 */
public interface LinkRequestOutcomeEmailService {

    /**
     * Sends the "accepted" or "declined" email for a decided request once the surrounding transaction has committed
     * (at once when there is none), and sets {@code requester_notified_at} on success. Never throws: a failure is
     * logged and leaves {@code requester_notified_at} empty.
     */
    void sendAfterCommit(UUID requestId);
}
