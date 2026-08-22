package com.cricketlegend.service;

import com.cricketlegend.dto.EmailSettingsDto;

/** docs/specs/018-email-configuration-and-test-send.md. */
public interface EmailSettingsService {
    EmailSettingsDto getSettings();
}
