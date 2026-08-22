package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import com.cricketlegend.service.EmailService;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * Plain JUnit 5 + Mockito, no Spring context — per docs/specs/017-subscription-welcome-email.md's
 * Test Plan ("SubscriptionWelcomeEmailServiceImplTest (new, real SpringTemplateEngine against the
 * checked-in templates, no Spring context needed)"). Package placement follows
 * docs/plans/017's Flag #1 (matching KeycloakProvisioningServiceImplTest/MeServiceImplTest's newer
 * com.cricketlegend.service.impl convention).
 *
 * <p>The {@link ClassLoaderTemplateResolver} below is configured to resolve template names the
 * same way Spring Boot's own {@code spring-boot-starter-thymeleaf} auto-configuration would
 * against {@code backend/src/main/resources/templates/} — prefix {@code /templates/}, suffix
 * {@code .html}, mode {@code HTML} — so the actual checked-in {@code email/base-layout.html} and
 * {@code email/subscription-welcome.html} files are rendered for real, not a test-only fixture.
 */
class SubscriptionWelcomeEmailServiceImplTest {

    private static final String FRONTEND_BASE_URL = "http://localhost:5173";
    private static final String SUPPORT_ADDRESS = "support@cricketlegend.co.za";

    private EmailService emailService;
    private SubscriptionWelcomeEmailServiceImpl service;

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
        service = new SubscriptionWelcomeEmailServiceImpl(
                emailService, templateEngine, FRONTEND_BASE_URL, SUPPORT_ADDRESS);
    }

    private Person person() {
        Person person = new Person();
        person.setId(UUID.randomUUID());
        person.setFirstName("Jaco");
        person.setLastName("Botha");
        person.setEmail("jaco@example.com");
        return person;
    }

    private Club club(String slug) {
        Club club = new Club();
        club.setId(UUID.randomUUID());
        club.setName("Riverside CC");
        club.setSlug(slug);
        club.setStatus(ClubStatus.ACTIVE);
        return club;
    }

    private Product product() {
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setCode("CLUB_STANDARD");
        product.setName("Club Standard");
        product.setStatus(ProductStatus.ACTIVE);
        return product;
    }

    private Subscription subscription(LocalDate startDate, LocalDate endDate) {
        Subscription subscription = new Subscription();
        subscription.setId(UUID.randomUUID());
        subscription.setOwnerType(SubscriptionOwnerType.CLUB);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartDate(startDate);
        subscription.setEndDate(endDate);
        return subscription;
    }

    private String captureSentHtmlBody() {
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(any(), any(), any(), bodyCaptor.capture());
        return bodyCaptor.getValue();
    }

    @Test
    void sendWelcomeEmailRendersFirstNameClubNameProductNameAndFormattedStartDateIntoTheHtmlBody() {
        Person person = person();
        Club club = club("riverside-cc");
        Product product = product();
        Subscription subscription = subscription(LocalDate.of(2026, 3, 1), null);

        service.sendWelcomeEmail(person, subscription, club, product);

        String htmlBody = captureSentHtmlBody();
        assertThat(htmlBody).contains("Jaco");
        assertThat(htmlBody).contains("Riverside CC");
        assertThat(htmlBody).contains("Club Standard");
        assertThat(htmlBody).contains("1 March 2026");
    }

    @Test
    void sendWelcomeEmailWithNullEndDateRendersOngoingLiteralRatherThanBlankOrNull() {
        Person person = person();
        Club club = club("riverside-cc");
        Product product = product();
        Subscription subscription = subscription(LocalDate.of(2026, 3, 1), null);

        service.sendWelcomeEmail(person, subscription, club, product);

        String htmlBody = captureSentHtmlBody();
        assertThat(htmlBody).contains("Ongoing - no fixed end date");
        assertThat(htmlBody).doesNotContain(">null<");
    }

    @Test
    void sendWelcomeEmailWithAnEndDateRendersItsFormattedValueRatherThanTheOngoingFallback() {
        Person person = person();
        Club club = club("riverside-cc");
        Product product = product();
        Subscription subscription = subscription(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 12, 31));

        service.sendWelcomeEmail(person, subscription, club, product);

        String htmlBody = captureSentHtmlBody();
        assertThat(htmlBody).contains("31 December 2026");
        assertThat(htmlBody).doesNotContain("Ongoing - no fixed end date");
    }

    @Test
    void sendWelcomeEmailBuildsALoginUrlPrefixingTheClubsSlugOntoTheFrontendBaseUrlsSchemeAndAuthority() {
        Person person = person();
        Club club = club("riverside-cc");
        Product product = product();
        Subscription subscription = subscription(LocalDate.of(2026, 3, 1), null);

        service.sendWelcomeEmail(person, subscription, club, product);

        String htmlBody = captureSentHtmlBody();
        assertThat(htmlBody).contains("http://riverside-cc.localhost:5173/login");
    }

    @Test
    void sendWelcomeEmailBuildsASubjectContainingTheClubNameAndPersonsFirstName() {
        Person person = person();
        Club club = club("riverside-cc");
        Product product = product();
        Subscription subscription = subscription(LocalDate.of(2026, 3, 1), null);

        service.sendWelcomeEmail(person, subscription, club, product);

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(any(), any(), subjectCaptor.capture(), any());
        assertThat(subjectCaptor.getValue()).contains("Riverside CC").contains("Jaco");
    }

    @Test
    void sendWelcomeEmailPropagatesTheSameSubjectIntoTheRenderedHtmlsTitleTag() {
        // Regression coverage: base-layout.html's <title th:text="${subject}"> reads a Thymeleaf
        // context variable that the implementation initially never set — Thymeleaf silently
        // resolves a missing variable to null rather than throwing, so the <title> rendered empty
        // with no test catching it until a standards review. Confirms the fix propagates through
        // the fragment call from subscription-welcome.html into base-layout.html, not just that
        // the variable is set somewhere.
        Person person = person();
        Club club = club("riverside-cc");
        Product product = product();
        Subscription subscription = subscription(LocalDate.of(2026, 3, 1), null);

        service.sendWelcomeEmail(person, subscription, club, product);

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(any(), any(), subjectCaptor.capture(), any());
        String htmlBody = captureSentHtmlBody();
        assertThat(htmlBody).contains("<title>" + subjectCaptor.getValue() + "</title>");
    }

    @Test
    void sendWelcomeEmailCallsEmailServiceSendWithThePersonsOwnEmailAsTheToAddress() {
        Person person = person();
        Club club = club("riverside-cc");
        Product product = product();
        Subscription subscription = subscription(LocalDate.of(2026, 3, 1), null);

        service.sendWelcomeEmail(person, subscription, club, product);

        verify(emailService).send(eq("jaco@example.com"), any(), any(), any());
    }
}
