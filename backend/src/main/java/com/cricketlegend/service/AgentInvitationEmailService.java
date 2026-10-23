package com.cricketlegend.service;

import java.util.UUID;

/**
 * The invitation email "<Name> invited you to manage <player> at <club>" (docs/specs/119, Decision 10). The invitee also
 * sees the invitation in the app, so the email is an addition: a failure is logged and never undoes the invitation.
 */
public interface AgentInvitationEmailService {

    /** Sends once the surrounding transaction has committed (at once when there is none). Never throws. */
    void sendAfterCommit(UUID linkId);
}
