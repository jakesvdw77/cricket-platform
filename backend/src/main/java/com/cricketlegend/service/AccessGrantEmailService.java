package com.cricketlegend.service;

import java.util.UUID;

/**
 * The short "you now have access" email for a person who already has an account (docs/specs/150). A person without an account
 * gets Keycloak's own invitation instead. The grant stands whether or not this arrives.
 */
public interface AccessGrantEmailService {

    /** Sends once the surrounding transaction has committed (at once when there is none). Never throws. */
    void sendAfterCommit(UUID grantId);
}
