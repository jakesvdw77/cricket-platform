package com.cricketlegend.service.impl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.EmailService;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.thymeleaf.context.IContext;
import org.thymeleaf.spring6.SpringTemplateEngine;

/** docs/specs/119 slice 4: the invitation email goes through EmailService and a send failure never undoes the invitation. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AgentInvitationEmailServiceImplTest {

    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private PersonRepository personRepository;
    @Mock private ClubRepository clubRepository;
    @Mock private EmailService emailService;
    @Mock private SpringTemplateEngine templateEngine;

    private AgentInvitationEmailServiceImpl service;
    private PersonLink invitation;

    @BeforeEach
    void setUp() {
        service = new AgentInvitationEmailServiceImpl(personLinkRepository, personRepository, clubRepository,
                emailService, templateEngine, "http://localhost:5173", "support@example.com");
        Club club = Club.builder().id(UUID.randomUUID()).name("Hillcrest CC").slug("hillcrest").status(ClubStatus.ACTIVE).build();
        Person child = Person.builder().id(UUID.randomUUID()).firstName("Sam").lastName("Smith").build();
        Person sender = Person.builder().id(UUID.randomUUID()).firstName("Pat").lastName("Parent").build();
        invitation = PersonLink.builder().id(UUID.randomUUID()).invitedEmail("guest@example.net")
                .subjectPersonId(child.getId()).clubId(club.getId()).grantedByPersonId(sender.getId())
                .status(PersonLinkStatus.INVITED).expiresAt(Instant.now().plusSeconds(86_400)).build();
        when(personLinkRepository.findById(invitation.getId())).thenReturn(Optional.of(invitation));
        when(clubRepository.findById(club.getId())).thenReturn(Optional.of(club));
        when(personRepository.findById(child.getId())).thenReturn(Optional.of(child));
        when(personRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(templateEngine.process(anyString(), any(IContext.class))).thenReturn("<html>x</html>");
    }

    @Test
    void sendsToTheInvitedAddressNamingTheSenderPlayerAndClub() {
        service.sendAfterCommit(invitation.getId());

        verify(emailService).send(eq("guest@example.net"), eq("guest@example.net"),
                contains("Pat Parent invited you to manage Sam Smith at Hillcrest CC"), eq("<html>x</html>"));
    }

    @Test
    void aThrownSendFailureIsSwallowedAndTheInvitationStandsOpen() {
        doThrow(new IllegalStateException("smtp down")).when(emailService).send(any(), any(), any(), any());

        service.sendAfterCommit(invitation.getId()); // must not throw

        org.assertj.core.api.Assertions.assertThat(invitation.getStatus()).isEqualTo(PersonLinkStatus.INVITED);
    }

    @Test
    void anInvitationThatIsNoLongerOpenSendsNothing() {
        invitation.setStatus(PersonLinkStatus.REVOKED);

        service.sendAfterCommit(invitation.getId());

        verify(emailService, never()).send(any(), any(), any(), any());
    }
}
