package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withRole;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.service.EmailService;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for EmailConfigController — per
 * docs/specs/018-email-configuration-and-test-send.md's Test Plan and
 * docs/plans/018-email-configuration-and-test-send.md's Phase 7 table.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * {@code SubscriptionControllerIntegrationTest}'s convention.
 *
 * <p>{@code EmailService} is {@code @MockitoBean}'d — without a mock, {@code POST /test-send}
 * would attempt a real SMTP connection to whatever {@code spring.mail.host}/{@code port} resolves
 * to (a local Mailpit/Mailhog sink that isn't running in CI). The real HTTP/security layer under
 * test here doesn't need SMTP reachable to be exercised — the test email's own
 * content/rendering and the catch-and-surface failure posture are covered by
 * {@code EmailTestSendServiceImplTest}'s own unit coverage, not here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class EmailConfigControllerIntegrationTest {

    @MockitoBean
    private EmailService emailService;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getSettingsAsPlatformAdminReturns200WithTheExpectedFields() throws Exception {
        mockMvc.perform(get("/api/v1/platform/email/settings").with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.host").isNotEmpty())
                .andExpect(jsonPath("$.port").isNumber())
                .andExpect(jsonPath("$.authEnabled").isBoolean())
                .andExpect(jsonPath("$.starttlsEnabled").isBoolean())
                .andExpect(jsonPath("$.fromAddress").isNotEmpty())
                .andExpect(jsonPath("$.fromName").isNotEmpty())
                .andExpect(jsonPath("$.supportAddress").isNotEmpty());
    }

    @Test
    void getSettingsResponseBodyNeverContainsUsernameOrPasswordAnywhere() throws Exception {
        // Defensive check against a future accidental leak, not just a trust-the-DTO assertion -
        // per docs/specs/018-email-configuration-and-test-send.md's Real Architectural Judgment
        // Call #1 and Acceptance Criteria.
        MvcResult result = mockMvc.perform(get("/api/v1/platform/email/settings").with(platformAdmin()))
                .andExpect(status().isOk())
                .andReturn();

        String rawBody = result.getResponse().getContentAsString().toLowerCase();
        assertThat(rawBody).doesNotContain("username");
        assertThat(rawBody).doesNotContain("password");
    }

    @Test
    void testSendWithAMockedSuccessfulEmailServiceReturns200WithSuccessTrueAndSentToEqualToTheJwtsEmailClaim()
            throws Exception {
        mockMvc.perform(post("/api/v1/platform/email/test-send")
                        .with(platformAdmin(b -> b.claim("email", "jaco@example.com").claim("name", "Jaco"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.sentTo").value("jaco@example.com"));
    }

    @Test
    void testSendWithEmailServiceThrowingStillReturns200WithSuccessFalseAndASpecificMessage() throws Exception {
        doThrow(new EmailDeliveryException("SMTP is unreachable", new RuntimeException("Connection refused")))
                .when(emailService)
                .send(any(), any(), any(), any());

        mockMvc.perform(post("/api/v1/platform/email/test-send")
                        .with(platformAdmin(b -> b.claim("email", "jaco@example.com").claim("name", "Jaco"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message", containsString("Failed to send test email")));
    }

    @Test
    void testSendWithAJwtHavingNoEmailClaimReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/platform/email/test-send").with(platformAdmin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getSettingsWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/platform/email/settings")).andExpect(status().isUnauthorized());
    }

    @Test
    void getSettingsWithNonPlatformAdminJwtReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/platform/email/settings")
                        .with(withRole("someone_else", UnaryOperator.identity())))
                .andExpect(status().isForbidden());
    }

    @Test
    void testSendWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/platform/email/test-send")).andExpect(status().isUnauthorized());
    }

    @Test
    void testSendWithNonPlatformAdminJwtReturns403() throws Exception {
        mockMvc.perform(post("/api/v1/platform/email/test-send")
                        .with(withRole("someone_else", UnaryOperator.identity())))
                .andExpect(status().isForbidden());
    }
}
