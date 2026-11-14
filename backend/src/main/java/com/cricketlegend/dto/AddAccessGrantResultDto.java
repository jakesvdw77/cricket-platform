package com.cricketlegend.dto;

/**
 * Per docs/specs/150. {@code accountExisted}: the person already had an account, so no password invitation was needed.
 * {@code invitationSent}: a password invitation was sent. {@code invitationFailed}: the grant was kept but the invitation could
 * not be sent (resend it from the card).
 */
public record AddAccessGrantResultDto(
        AccessGrantDto grant, boolean accountExisted, boolean invitationSent, boolean invitationFailed) {}
