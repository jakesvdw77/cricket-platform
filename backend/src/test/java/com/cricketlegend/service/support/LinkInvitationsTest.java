package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/** docs/specs/119 slice 4: the one place an INVITED link is created, for agents and for the club. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LinkInvitationsTest {

    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private PersonRepository personRepository;

    private LinkInvitations invitations;
    private final UUID subject = UUID.randomUUID();
    private final UUID club = UUID.randomUUID();
    private final UUID sender = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        invitations = new LinkInvitations(personLinkRepository, personRepository);
        when(personRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(personLinkRepository.findOpenInvitationsBySubjectAndClub(any(), any(), any())).thenReturn(List.of());
        when(personLinkRepository.save(any(PersonLink.class))).thenAnswer(i -> i.getArgument(0));
    }

    private PersonLink create(String email, String senderEmail) {
        return invitations.create(subject, club, email, true, LinkGrantedVia.AGENT_INVITE, sender, senderEmail);
    }

    @Test
    void createsAnInvitedLinkWithALowerCasedEmailAndFourteenDaysOfValidity() {
        PersonLink link = create("  New.Agent@Example.COM ", "me@example.com");

        assertThat(link.getStatus()).isEqualTo(PersonLinkStatus.INVITED);
        assertThat(link.getInvitedEmail()).isEqualTo("new.agent@example.com");
        assertThat(link.getAccountPersonId()).isNull();
        assertThat(link.isMain()).isFalse();
        assertThat(link.isMakeMain()).isTrue();
        assertThat(link.getGrantedByPersonId()).isEqualTo(sender);
        assertThat(link.getGrantedVia()).isEqualTo(LinkGrantedVia.AGENT_INVITE);
        assertThat(link.getExpiresAt()).isBetween(
                Instant.now().plus(LinkInvitations.VALIDITY).minusSeconds(60), Instant.now().plus(LinkInvitations.VALIDITY).plusSeconds(60));
    }

    @Test
    void aMalformedAddressIsRefused() {
        for (String bad : new String[] {null, "", "  ", "no-at", "a@b", "a b@c.d"}) {
            assertThatThrownBy(() -> create(bad, null)).as(String.valueOf(bad)).isInstanceOf(ValidationException.class);
        }
        verify(personLinkRepository, never()).save(any());
    }

    @Test
    void theSendersOwnAddressIsRefusedIgnoringCase() {
        assertThatThrownBy(() -> create("ME@example.com", "me@Example.com")).isInstanceOf(ValidationException.class);
    }

    @Test
    void thePlayersOwnAccountCannotBeTheirAgent() {
        when(personRepository.findByEmailIgnoreCase("kid@example.com"))
                .thenReturn(Optional.of(Person.builder().id(subject).build()));

        assertThatThrownBy(() -> create("kid@example.com", null)).isInstanceOf(ValidationException.class);
    }

    @Test
    void anAccountThatAlreadyHoldsAnOpenLinkIsAConflict() {
        Person existing = Person.builder().id(UUID.randomUUID()).build();
        when(personRepository.findByEmailIgnoreCase("agent@example.com")).thenReturn(Optional.of(existing));
        when(personLinkRepository.findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                        any(), any(), any(), any()))
                .thenReturn(Optional.of(PersonLink.builder().build()));

        assertThatThrownBy(() -> create("agent@example.com", null)).isInstanceOf(ConflictException.class);
    }

    @Test
    void aSecondOpenInvitationForTheSameEmailIsAConflict() {
        when(personLinkRepository.findOpenInvitationsBySubjectAndClub(any(), any(), any()))
                .thenReturn(List.of(PersonLink.builder().invitedEmail("Agent@Example.com").build()));

        assertThatThrownBy(() -> create("agent@example.com", null)).isInstanceOf(ConflictException.class);
        verify(personLinkRepository, never()).save(any());
    }
}
