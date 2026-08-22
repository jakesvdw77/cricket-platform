package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.cricketlegend.dto.EmailTestSendResultDto;
import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Plain JUnit 5 + Mockito, no Spring context — per
 * docs/specs/018-email-configuration-and-test-send.md's Test Plan ("EmailTestSendServiceImplTest
 * (new, real SpringTemplateEngine against the checked-in test-send.html, no Spring context
 * needed, mirroring 017's own SubscriptionWelcomeEmailServiceImplTest precedent)"). Mirrors
 * {@code SubscriptionWelcomeEmailServiceImplTest}'s own {@link ClassLoaderTemplateResolver} setup
 * exactly, so the real checked-in {@code email/base-layout.html}/{@code email/test-send.html}
 * files are rendered for real, not a test-only fixture.
 */
class EmailTestSendServiceImplTest {

    private static final String FROM_ADDRESS = "no-reply@cricketlegend.co.za";
    private static final String FRONTEND_BASE_URL = "http://localhost:5173";

    private EmailService emailService;
    private EmailTestSendServiceImpl service;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode(TemplateMode.HTML);
        templateResolver.setCharacterEncoding("UTF-8");

        SpringTemplateEngine templateEngine = new SpringTemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);

        emailService = mock(EmailService.class);
        service = new EmailTestSendServiceImpl(emailService, templateEngine, FROM_ADDRESS, FRONTEND_BASE_URL);
    }

    private String captureSentHtmlBody() {
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(any(), any(), any(), bodyCaptor.capture());
        return bodyCaptor.getValue();
    }

    @Test
    void sendTestEmailRendersSentAtFromAddressAndFrontendBaseUrlIntoTheHtmlBody() {
        service.sendTestEmail("jaco@example.com", "Jaco Botha");

        String htmlBody = captureSentHtmlBody();
        assertThat(htmlBody).contains(FROM_ADDRESS);
        assertThat(htmlBody).contains(FRONTEND_BASE_URL);
        // sentAt is formatted "d MMMM yyyy, HH:mm" - assert the rendered "Sent at" row isn't the
        // unresolved literal placeholder rather than pinning an exact, time-sensitive value.
        assertThat(htmlBody).doesNotContain("${sentAt}");
        assertThat(htmlBody).doesNotContain(">null<");
    }

    @Test
    void sendTestEmailOnASuccessfulSendReturnsSuccessTrueWithSentToEqualToTheGivenToAddress() {
        EmailTestSendResultDto result = service.sendTestEmail("jaco@example.com", "Jaco Botha");

        assertThat(result.success()).isTrue();
        assertThat(result.sentTo()).isEqualTo("jaco@example.com");
        assertThat(result.message()).contains("jaco@example.com");
    }

    @Test
    void sendTestEmailCallsEmailServiceSendWithTheGivenToAddress() {
        service.sendTestEmail("jaco@example.com", "Jaco Botha");

        verify(emailService).send(eq("jaco@example.com"), any(), any(), any());
    }

    @Test
    void sendTestEmailCatchesAnEmailDeliveryExceptionRatherThanPropagatingIt() {
        doThrow(new EmailDeliveryException("SMTP send failed", new RuntimeException("Connection refused")))
                .when(emailService)
                .send(any(), any(), any(), any());

        // Never throws - the load-bearing contract the controller (and every caller) relies on.
        // If sendTestEmail let the EmailDeliveryException propagate, this call itself would throw
        // and fail the test before reaching the assertion below.
        EmailTestSendResultDto result = service.sendTestEmail("jaco@example.com", "Jaco Botha");

        assertThat(result).isNotNull();
    }

    @Test
    void sendTestEmailOnAnEmailDeliveryExceptionReturnsSuccessFalseWithAMessageStartingWithTheFixedPrefixAndContainingTheCausesMessage() {
        doThrow(new EmailDeliveryException("SMTP send failed", new RuntimeException("Connection refused")))
                .when(emailService)
                .send(any(), any(), any(), any());

        EmailTestSendResultDto result = service.sendTestEmail("jaco@example.com", "Jaco Botha");

        assertThat(result.success()).isFalse();
        assertThat(result.message()).startsWith("Failed to send test email: ");
        assertThat(result.message()).contains("Connection refused");
        assertThat(result.sentTo()).isEqualTo("jaco@example.com");
    }

    @Test
    void sendTestEmailOnAnEmailDeliveryExceptionWithNoCauseFallsBackToTheExceptionsOwnMessage() {
        doThrow(new EmailDeliveryException("SMTP send failed with no underlying cause", null))
                .when(emailService)
                .send(any(), any(), any(), any());

        EmailTestSendResultDto result = service.sendTestEmail("jaco@example.com", "Jaco Botha");

        assertThat(result.success()).isFalse();
        assertThat(result.message()).isEqualTo("Failed to send test email: SMTP send failed with no underlying cause");
    }
}
