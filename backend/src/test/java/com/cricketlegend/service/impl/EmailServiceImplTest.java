package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.exception.EmailDeliveryException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Plain JUnit 5 + Mockito, no Spring context — per
 * docs/specs/017-subscription-welcome-email.md's Test Plan ("EmailServiceImplTest (new) — a mocked
 * JavaMailSender/MimeMessage..."). Package placement follows docs/plans/017's Flag #1 (matching
 * KeycloakProvisioningServiceImplTest/MeServiceImplTest's newer com.cricketlegend.service.impl
 * convention). A real {@link MimeMessage} (backed by an in-memory {@link Session}) is used rather
 * than a mock — MimeMessageHelper writes through to it, and a mock can't hold that state.
 */
class EmailServiceImplTest {

    private static final String FROM_ADDRESS = "no-reply@cricketlegend.co.za";
    private static final String FROM_NAME = "Cricket Legend";

    private JavaMailSender mailSender;
    private EmailServiceImpl emailService;

    @BeforeEach
    void setUp() {
        mailSender = mock(JavaMailSender.class);
        emailService = new EmailServiceImpl(mailSender, FROM_ADDRESS, FROM_NAME);
    }

    private MimeMessage realMimeMessage() {
        return new MimeMessage(Session.getDefaultInstance(new Properties()));
    }

    @Test
    void sendSetsFromAddressAndNameToAddressSubjectAndHtmlBodyOnTheMimeMessage() throws Exception {
        MimeMessage message = realMimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(message);

        emailService.send(
                "jane.doe@example.com", "Jane Doe", "Welcome to Riverside CC", "<p>Hi Jane</p>");
        // MimeMessage only writes its Content-Type header on saveChanges() — a real send via
        // JavaMailSender.send()/Transport does this internally, but the mocked sender here never
        // touches the message, so it's called explicitly to inspect the header that would
        // otherwise be written.
        message.saveChanges();

        assertThat(message.getFrom()[0].toString()).contains(FROM_ADDRESS).contains(FROM_NAME);
        assertThat(message.getAllRecipients()[0].toString()).contains("jane.doe@example.com");
        assertThat(message.getSubject()).isEqualTo("Welcome to Riverside CC");
        assertThat(message.getContentType()).contains("text/html");
        assertThat(message.getContent().toString()).isEqualTo("<p>Hi Jane</p>");
    }

    @Test
    void sendCallsJavaMailSenderSendWithTheBuiltMessage() {
        MimeMessage message = realMimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(message);

        emailService.send("jane.doe@example.com", "Jane Doe", "Subject", "<p>Body</p>");

        org.mockito.Mockito.verify(mailSender).send(message);
    }

    @Test
    void anExceptionThrownByTheMailSenderIsWrappedInEmailDeliveryException() {
        MimeMessage message = realMimeMessage();
        when(mailSender.createMimeMessage()).thenReturn(message);
        RuntimeException underlying = new RuntimeException("SMTP is unreachable");
        org.mockito.Mockito.doThrow(underlying).when(mailSender).send(message);

        assertThatThrownBy(() ->
                        emailService.send("jane.doe@example.com", "Jane Doe", "Subject", "<p>Body</p>"))
                .isInstanceOf(EmailDeliveryException.class)
                .hasCause(underlying);
    }

    @Test
    void anExceptionThrownWhileBuildingTheMimeMessageIsWrappedInEmailDeliveryException() {
        when(mailSender.createMimeMessage()).thenThrow(new RuntimeException("cannot create message"));

        assertThatThrownBy(() ->
                        emailService.send("jane.doe@example.com", "Jane Doe", "Subject", "<p>Body</p>"))
                .isInstanceOf(EmailDeliveryException.class);
    }
}
