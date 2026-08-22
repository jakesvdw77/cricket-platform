package com.cricketlegend.dto;

/**
 * The safe-to-display subset of this application's own outbound SMTP configuration - see
 * docs/specs/018-email-configuration-and-test-send.md's Real Architectural Judgment Calls #1.
 * Deliberately excludes spring.mail.username/spring.mail.password entirely - not even a boolean
 * "is a password configured" flag.
 */
public record EmailSettingsDto(
        String host,
        int port,
        boolean authEnabled,
        boolean starttlsEnabled,
        String fromAddress,
        String fromName,
        String supportAddress) {
}
