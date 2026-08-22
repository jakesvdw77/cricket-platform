package com.cricketlegend.controller;

import com.cricketlegend.dto.EmailSettingsDto;
import com.cricketlegend.dto.EmailTestSendResultDto;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.EmailSettingsService;
import com.cricketlegend.service.EmailTestSendService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/email")
class EmailConfigController {

    private final EmailSettingsService emailSettingsService;
    private final EmailTestSendService emailTestSendService;

    EmailConfigController(EmailSettingsService emailSettingsService, EmailTestSendService emailTestSendService) {
        this.emailSettingsService = emailSettingsService;
        this.emailTestSendService = emailTestSendService;
    }

    @GetMapping("/settings")
    EmailSettingsDto getSettings() {
        return emailSettingsService.getSettings();
    }

    @PostMapping("/test-send")
    EmailTestSendResultDto testSend(@AuthenticationPrincipal Jwt jwt) {
        // Same JWT email claim MeServiceImpl.bridgeByEmail (016) already reads - "the admin" is
        // always the caller's own resolved email, never a request-body destination (judgment
        // call #2).
        String email = jwt.getClaimAsString("email");
        if (email == null) {
            throw new ValidationException("Your login session has no email address to send a test email to.");
        }
        String name = jwt.getClaimAsString("name");
        return emailTestSendService.sendTestEmail(email, name != null ? name : email);
    }
}
