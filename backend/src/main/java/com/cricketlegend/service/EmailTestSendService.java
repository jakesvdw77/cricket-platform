package com.cricketlegend.service;

import com.cricketlegend.dto.EmailTestSendResultDto;

/** docs/specs/018-email-configuration-and-test-send.md. Never throws - see judgment call #3. */
public interface EmailTestSendService {
    EmailTestSendResultDto sendTestEmail(String toAddress, String toName);
}
