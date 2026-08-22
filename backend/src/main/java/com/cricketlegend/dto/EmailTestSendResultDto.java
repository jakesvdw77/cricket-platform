package com.cricketlegend.dto;

/**
 * docs/specs/018-email-configuration-and-test-send.md. Always returned inside a 200 response -
 * success or failure is data here, not a transport-level error - see that spec's judgment call #3
 * for why a failed send is reported this way rather than thrown to GlobalExceptionHandler.
 */
public record EmailTestSendResultDto(boolean success, String message, String sentTo) {
}
