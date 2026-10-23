package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.AgentInvitationEmailService;
import com.cricketlegend.service.EmailService;
import com.cricketlegend.service.support.AfterCommit;
import java.net.URI;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
public class AgentInvitationEmailServiceImpl implements AgentInvitationEmailService {

    private static final Logger log = LoggerFactory.getLogger(AgentInvitationEmailServiceImpl.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.UK);

    private final PersonLinkRepository personLinkRepository;
    private final PersonRepository personRepository;
    private final ClubRepository clubRepository;
    private final EmailService emailService;
    private final SpringTemplateEngine templateEngine;
    private final String frontendBaseUrl;
    private final String supportAddress;

    public AgentInvitationEmailServiceImpl(
            PersonLinkRepository personLinkRepository,
            PersonRepository personRepository,
            ClubRepository clubRepository,
            EmailService emailService,
            SpringTemplateEngine templateEngine,
            @Value("${app.frontend.base-url}") String frontendBaseUrl,
            @Value("${app.mail.support-address}") String supportAddress) {
        this.personLinkRepository = personLinkRepository;
        this.personRepository = personRepository;
        this.clubRepository = clubRepository;
        this.emailService = emailService;
        this.templateEngine = templateEngine;
        this.frontendBaseUrl = frontendBaseUrl;
        this.supportAddress = supportAddress;
    }

    @Override
    public void sendAfterCommit(UUID linkId) {
        AfterCommit.run(() -> sendNow(linkId));
    }

    private void sendNow(UUID linkId) {
        try {
            PersonLink link = personLinkRepository.findById(linkId).orElse(null);
            if (link == null || link.getStatus() != PersonLinkStatus.INVITED || link.getInvitedEmail() == null) {
                return;
            }
            Club club = clubRepository.findById(link.getClubId()).orElse(null);
            Person subject = personRepository.findById(link.getSubjectPersonId()).orElse(null);
            if (club == null || subject == null) {
                return;
            }
            Person sender = link.getGrantedByPersonId() == null
                    ? null
                    : personRepository.findById(link.getGrantedByPersonId()).orElse(null);
            String senderName = sender == null ? club.getName() : LinkRequestMapper.fullName(sender);
            String playerName = LinkRequestMapper.fullName(subject);
            String mailSubject = senderName + " invited you to manage " + playerName + " at " + club.getName();

            Context context = new Context();
            context.setVariable("subject", mailSubject);
            context.setVariable("senderName", senderName);
            context.setVariable("playerName", playerName);
            context.setVariable("clubName", club.getName());
            context.setVariable("makeMain", link.isMakeMain());
            context.setVariable("expiresOn", link.getExpiresAt() == null
                    ? null
                    : DATE.format(link.getExpiresAt().atZone(ZoneId.systemDefault())));
            context.setVariable("accountUrl", accountUrl(club.getSlug()));
            context.setVariable("supportAddress", supportAddress);
            String html = templateEngine.process("email/agent-invitation", context);

            emailService.send(link.getInvitedEmail(), link.getInvitedEmail(), mailSubject, html);
            log.info("Agent invitation email sent: link={} club={}", linkId, link.getClubId());
        } catch (Exception e) {
            // the invitation stands and the invitee also sees it in the app
            log.warn("Agent invitation email failed: link={} reason={}", linkId, e.toString());
        }
    }

    private String accountUrl(String slug) {
        URI base = URI.create(frontendBaseUrl);
        return base.getScheme() + "://" + slug + "." + base.getAuthority() + "/account";
    }
}
