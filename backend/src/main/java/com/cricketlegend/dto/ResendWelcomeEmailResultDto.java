package com.cricketlegend.dto;

/**
 * docs/specs/019-resend-subscription-welcome-email.md. Always returned inside a 200 response -
 * success or failure is data here, not a transport-level error - mirrors EmailTestSendResultDto
 * (018) exactly, see that spec's Real Architectural Judgment Calls #1 for why a failed resend is
 * reported this way rather than thrown to GlobalExceptionHandler.
 */
public record ResendWelcomeEmailResultDto(boolean success, String message, String sentTo) {
}
