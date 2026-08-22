package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.service.EmailService;
import com.cricketlegend.service.SubscriptionWelcomeEmailService;
import java.net.URI;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
public class SubscriptionWelcomeEmailServiceImpl implements SubscriptionWelcomeEmailService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.UK);

    private final EmailService emailService;
    private final SpringTemplateEngine templateEngine;
    private final String frontendBaseUrl;
    private final String supportAddress;

    public SubscriptionWelcomeEmailServiceImpl(
            EmailService emailService,
            SpringTemplateEngine templateEngine,
            @Value("${app.frontend.base-url}") String frontendBaseUrl,
            @Value("${app.mail.support-address}") String supportAddress) {
        this.emailService = emailService;
        this.templateEngine = templateEngine;
        this.frontendBaseUrl = frontendBaseUrl;
        this.supportAddress = supportAddress;
    }

    @Override
    public void sendWelcomeEmail(Person person, Subscription subscription, Club club, Product product) {
        // Wraps the whole build-and-send pipeline, not just EmailService.send() — a template
        // rendering failure (e.g. a broken Thymeleaf fragment) must surface as EmailDeliveryException
        // too, the same as a real SMTP failure, so SubscriptionServiceImpl's best-effort catch block
        // actually catches it. Found the hard way during test-writer's own pass: base-layout.html
        // was initially missing its th:fragment declaration, and the resulting TemplateInputException
        // was not an EmailDeliveryException, so it propagated straight out of create().
        try {
            String subject = "Welcome to " + club.getName() + " on Cricket Legend, " + person.getFirstName() + "!";

            Context context = new Context();
            // "subject" is read by base-layout.html's own <title th:text="${subject}"> — must be
            // set here before process(...), not left to the local Java variable alone, or the
            // rendered email's <title> silently comes out empty (found during standards review;
            // Thymeleaf resolves a missing context variable to null rather than throwing, so this
            // never surfaced as a bug, just a silently-empty <title>).
            context.setVariable("subject", subject);
            context.setVariable("firstName", person.getFirstName());
            context.setVariable("clubName", club.getName());
            context.setVariable("productName", product.getName());
            context.setVariable("startDate", DATE_FORMAT.format(subscription.getStartDate()));
            context.setVariable("endDate", subscription.getEndDate() == null
                    ? "Ongoing - no fixed end date"
                    : DATE_FORMAT.format(subscription.getEndDate()));
            context.setVariable("loginUrl", buildClubLoginUrl(club.getSlug()));
            context.setVariable("supportAddress", supportAddress);

            String htmlBody = templateEngine.process("email/subscription-welcome", context);

            emailService.send(person.getEmail(), person.getFirstName() + " " + person.getLastName(), subject, htmlBody);
        } catch (EmailDeliveryException e) {
            throw e;
        } catch (Exception e) {
            throw new EmailDeliveryException(
                    "Failed to build/send welcome email for person " + person.getId(), e);
        }
    }

    private String buildClubLoginUrl(String slug) {
        // Same URL shape ui/src/pages/view/LandingPage/FindYourClubLogin.tsx's goToClubLogin
        // already builds client-side - see judgment call #7 for why app.frontend.base-url is
        // reused rather than a new "root domain" property being added.
        URI base = URI.create(frontendBaseUrl);
        return base.getScheme() + "://" + slug + "." + base.getAuthority() + "/login";
    }
}
