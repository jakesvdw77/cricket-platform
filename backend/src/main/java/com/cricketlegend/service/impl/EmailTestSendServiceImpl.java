package com.cricketlegend.service.impl;

import com.cricketlegend.dto.EmailTestSendResultDto;
import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.service.EmailService;
import com.cricketlegend.service.EmailTestSendService;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
public class EmailTestSendServiceImpl implements EmailTestSendService {

    private static final DateTimeFormatter SENT_AT_FORMAT =
            DateTimeFormatter.ofPattern("d MMMM yyyy, HH:mm", Locale.UK).withZone(ZoneId.systemDefault());

    private final EmailService emailService;
    private final SpringTemplateEngine templateEngine;
    private final String fromAddress;
    private final String frontendBaseUrl;

    public EmailTestSendServiceImpl(
            EmailService emailService,
            SpringTemplateEngine templateEngine,
            @Value("${app.mail.from-address}") String fromAddress,
            @Value("${app.frontend.base-url}") String frontendBaseUrl) {
        this.emailService = emailService;
        this.templateEngine = templateEngine;
        this.fromAddress = fromAddress;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    @Override
    public EmailTestSendResultDto sendTestEmail(String toAddress, String toName) {
        String subject = "Cricket Legend - SMTP test email";

        try {
            Context context = new Context();
            context.setVariable("subject", subject);
            context.setVariable("sentAt", SENT_AT_FORMAT.format(Instant.now()));
            context.setVariable("fromAddress", fromAddress);
            context.setVariable("frontendBaseUrl", frontendBaseUrl);
            String htmlBody = templateEngine.process("email/test-send", context);

            emailService.send(toAddress, toName, subject, htmlBody);
            return new EmailTestSendResultDto(true, "Test email sent to " + toAddress + ".", toAddress);
        } catch (EmailDeliveryException e) {
            // Diagnostic action, not a best-effort side effect (contrast with 016/017's own
            // catch-log-swallow posture) - the failure is real, visible data in the response.
            return new EmailTestSendResultDto(false, "Failed to send test email: " + rootCauseMessage(e), toAddress);
        }
    }

    private String rootCauseMessage(EmailDeliveryException e) {
        Throwable cause = e.getCause();
        return cause != null && cause.getMessage() != null ? cause.getMessage() : e.getMessage();
    }
}
