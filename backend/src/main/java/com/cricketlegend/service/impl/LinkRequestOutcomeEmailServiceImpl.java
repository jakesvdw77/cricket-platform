package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LinkRequestRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.EmailService;
import com.cricketlegend.service.LinkRequestOutcomeEmailService;
import com.cricketlegend.service.support.AfterCommit;
import java.net.URI;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
public class LinkRequestOutcomeEmailServiceImpl implements LinkRequestOutcomeEmailService {

    private static final Logger log = LoggerFactory.getLogger(LinkRequestOutcomeEmailServiceImpl.class);

    private final LinkRequestRepository linkRequestRepository;
    private final PersonRepository personRepository;
    private final ClubRepository clubRepository;
    private final EmailService emailService;
    private final SpringTemplateEngine templateEngine;
    private final TransactionTemplate newTransaction;
    private final String frontendBaseUrl;
    private final String supportAddress;

    public LinkRequestOutcomeEmailServiceImpl(
            LinkRequestRepository linkRequestRepository,
            PersonRepository personRepository,
            ClubRepository clubRepository,
            EmailService emailService,
            SpringTemplateEngine templateEngine,
            PlatformTransactionManager transactionManager,
            @Value("${app.frontend.base-url}") String frontendBaseUrl,
            @Value("${app.mail.support-address}") String supportAddress) {
        this.linkRequestRepository = linkRequestRepository;
        this.personRepository = personRepository;
        this.clubRepository = clubRepository;
        this.emailService = emailService;
        this.templateEngine = templateEngine;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.frontendBaseUrl = frontendBaseUrl;
        this.supportAddress = supportAddress;
    }

    @Override
    public void sendAfterCommit(UUID requestId) {
        AfterCommit.run(() -> sendNow(requestId));
    }

    private void sendNow(UUID requestId) {
        try {
            LinkRequest request = linkRequestRepository.findById(requestId).orElse(null);
            if (request == null
                    || (request.getStatus() != LinkRequestStatus.APPROVED
                            && request.getStatus() != LinkRequestStatus.DECLINED)) {
                return;
            }
            Person requester = personRepository.findById(request.getAccountPersonId()).orElse(null);
            Club club = clubRepository.findById(request.getClubId()).orElse(null);
            if (requester == null || club == null || requester.getEmail() == null || requester.getEmail().isBlank()) {
                log.warn("Link request outcome email skipped: request={} (no recipient)", requestId);
                return;
            }
            boolean accepted = request.getStatus() == LinkRequestStatus.APPROVED;
            String subject = accepted
                    ? "Your request at " + club.getName() + " was accepted"
                    : "Your request at " + club.getName() + " was declined";
            Context context = new Context();
            context.setVariable("subject", subject);
            context.setVariable("firstName", requester.getFirstName());
            context.setVariable("clubName", club.getName());
            context.setVariable("playerName", request.getTypedFirstName() + " " + request.getTypedLastName());
            context.setVariable("accepted", accepted);
            context.setVariable("note", request.getDecisionNote());
            context.setVariable("accountUrl", accountUrl(club.getSlug()));
            context.setVariable("supportAddress", supportAddress);
            String html = templateEngine.process("email/link-request-outcome", context);

            emailService.send(requester.getEmail(), requester.getFirstName() + " " + requester.getLastName(), subject, html);

            newTransaction.executeWithoutResult(status -> linkRequestRepository.findById(requestId).ifPresent(r -> {
                r.setRequesterNotifiedAt(Instant.now());
                linkRequestRepository.save(r);
            }));
            log.info("Link request outcome email sent: request={} outcome={}", requestId, request.getStatus());
        } catch (Exception e) {
            // the decision stands and the in-app status is the source of truth; requester_notified_at stays empty
            log.warn("Link request outcome email failed: request={} reason={}", requestId, e.toString());
        }
    }

    private String accountUrl(String slug) {
        URI base = URI.create(frontendBaseUrl);
        return base.getScheme() + "://" + slug + "." + base.getAuthority() + "/account";
    }
}
