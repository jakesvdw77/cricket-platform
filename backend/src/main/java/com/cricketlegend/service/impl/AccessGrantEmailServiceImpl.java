package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AccessRole;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.AccessRoleRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.AccessGrantEmailService;
import com.cricketlegend.service.EmailService;
import com.cricketlegend.service.support.AfterCommit;
import java.net.URI;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
public class AccessGrantEmailServiceImpl implements AccessGrantEmailService {

    private static final Logger log = LoggerFactory.getLogger(AccessGrantEmailServiceImpl.class);

    private final RoleAssignmentRepository roleAssignmentRepository;
    private final PersonRepository personRepository;
    private final ClubRepository clubRepository;
    private final SectionRepository sectionRepository;
    private final AccessRoleRepository accessRoleRepository;
    private final EmailService emailService;
    private final SpringTemplateEngine templateEngine;
    private final String frontendBaseUrl;
    private final String supportAddress;

    public AccessGrantEmailServiceImpl(
            RoleAssignmentRepository roleAssignmentRepository,
            PersonRepository personRepository,
            ClubRepository clubRepository,
            SectionRepository sectionRepository,
            AccessRoleRepository accessRoleRepository,
            EmailService emailService,
            SpringTemplateEngine templateEngine,
            @Value("${app.frontend.base-url}") String frontendBaseUrl,
            @Value("${app.mail.support-address}") String supportAddress) {
        this.roleAssignmentRepository = roleAssignmentRepository;
        this.personRepository = personRepository;
        this.clubRepository = clubRepository;
        this.sectionRepository = sectionRepository;
        this.accessRoleRepository = accessRoleRepository;
        this.emailService = emailService;
        this.templateEngine = templateEngine;
        this.frontendBaseUrl = frontendBaseUrl;
        this.supportAddress = supportAddress;
    }

    @Override
    public void sendAfterCommit(UUID grantId) {
        AfterCommit.run(() -> sendNow(grantId));
    }

    private void sendNow(UUID grantId) {
        try {
            RoleAssignment grant = roleAssignmentRepository.findById(grantId).orElse(null);
            if (grant == null || grant.getScopeId() == null) {
                return;
            }
            Person person = personRepository.findById(grant.getPersonId()).orElse(null);
            Section section = grant.getScopeType() == ScopeType.SECTION
                    ? sectionRepository.findById(grant.getScopeId()).orElse(null)
                    : null;
            UUID clubId = section != null ? section.getClubId() : grant.getScopeId();
            Club club = clubRepository.findById(clubId).orElse(null);
            AccessRole role = grant.getAccessRoleId() == null
                    ? null
                    : accessRoleRepository.findById(grant.getAccessRoleId()).orElse(null);
            if (person == null || person.getEmail() == null || club == null) {
                return;
            }
            Person sender = grant.getGrantedByPersonId() == null
                    ? null
                    : personRepository.findById(grant.getGrantedByPersonId()).orElse(null);
            String senderName = sender == null ? club.getName() : LinkRequestMapper.fullName(sender);
            String roleName = role == null ? "Manager" : role.getName();
            String place = section == null ? "the whole club" : section.getName();
            String subject = senderName + " gave you access to " + club.getName();

            Context context = new Context();
            context.setVariable("subject", subject);
            context.setVariable("senderName", senderName);
            context.setVariable("roleName", roleName);
            context.setVariable("place", place);
            context.setVariable("clubName", club.getName());
            context.setVariable("clubUrl", clubUrl(club.getSlug()));
            context.setVariable("supportAddress", supportAddress);
            String html = templateEngine.process("email/access-granted", context);

            emailService.send(person.getEmail(), LinkRequestMapper.fullName(person), subject, html);
            log.info("Access granted email sent: grant={} club={}", grantId, clubId);
        } catch (Exception e) {
            // the grant stands and the person sees the club next time they sign in
            log.warn("Access granted email failed: grant={} reason={}", grantId, e.toString());
        }
    }

    private String clubUrl(String slug) {
        URI base = URI.create(frontendBaseUrl);
        return base.getScheme() + "://" + slug + "." + base.getAuthority() + "/manage";
    }
}
