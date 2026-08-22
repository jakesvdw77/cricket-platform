package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.EmailSettingsDto;
import java.lang.reflect.RecordComponent;
import org.junit.jupiter.api.Test;

/**
 * Plain JUnit 5, no Spring context — per docs/specs/018-email-configuration-and-test-send.md's
 * Test Plan ("EmailSettingsServiceImplTest (new) - getSettings() returns a DTO whose fields match
 * the injected @Value-bound properties exactly"). Package placement follows the same
 * com.cricketlegend.service.impl convention EmailTestSendServiceImplTest/
 * SubscriptionWelcomeEmailServiceImplTest (017) already established.
 */
class EmailSettingsServiceImplTest {

    @Test
    void getSettingsReturnsADtoMatchingTheInjectedValueBindingsExactly() {
        EmailSettingsServiceImpl service = new EmailSettingsServiceImpl(
                "smtp.gmail.com", 587, true, true, "no-reply@cricketlegend.co.za", "Cricket Legend",
                "support@cricketlegend.co.za");

        EmailSettingsDto settings = service.getSettings();

        assertThat(settings.host()).isEqualTo("smtp.gmail.com");
        assertThat(settings.port()).isEqualTo(587);
        assertThat(settings.authEnabled()).isTrue();
        assertThat(settings.starttlsEnabled()).isTrue();
        assertThat(settings.fromAddress()).isEqualTo("no-reply@cricketlegend.co.za");
        assertThat(settings.fromName()).isEqualTo("Cricket Legend");
        assertThat(settings.supportAddress()).isEqualTo("support@cricketlegend.co.za");
    }

    @Test
    void getSettingsReflectsDifferentInjectedValuesRatherThanHardcodedDefaults() {
        EmailSettingsServiceImpl service = new EmailSettingsServiceImpl(
                "localhost", 1025, false, false, "dev@cricketlegend.co.za", "Cricket Legend Dev",
                "dev-support@cricketlegend.co.za");

        EmailSettingsDto settings = service.getSettings();

        assertThat(settings.host()).isEqualTo("localhost");
        assertThat(settings.port()).isEqualTo(1025);
        assertThat(settings.authEnabled()).isFalse();
        assertThat(settings.starttlsEnabled()).isFalse();
        assertThat(settings.fromAddress()).isEqualTo("dev@cricketlegend.co.za");
        assertThat(settings.fromName()).isEqualTo("Cricket Legend Dev");
        assertThat(settings.supportAddress()).isEqualTo("dev-support@cricketlegend.co.za");
    }

    @Test
    void emailSettingsDtoNeverGrowsAUsernameOrPasswordComponent() {
        // Regression guard for docs/specs/018-email-configuration-and-test-send.md's Real
        // Architectural Judgment Call #1 - spring.mail.username/spring.mail.password (or any
        // derived boolean) must never become a field on this DTO, the way 016's own
        // email_verified regression test guarded its own security fix rather than relying on the
        // type system/code review alone.
        RecordComponent[] components = EmailSettingsDto.class.getRecordComponents();

        assertThat(components).isNotEmpty();
        assertThat(components)
                .extracting(RecordComponent::getName)
                .noneMatch(name -> name.toLowerCase().contains("username"))
                .noneMatch(name -> name.toLowerCase().contains("password"));
    }
}
