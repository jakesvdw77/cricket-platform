package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AgentInviteMode;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.InviteAgentRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.EmailNotVerifiedException;
import com.cricketlegend.exception.LinkRateLimitedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.service.AgentInvitationEmailService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.LinkAttemptLimiter;
import com.cricketlegend.service.support.LinkInvitations;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

/** docs/specs/119 slice 4: invite, hand over, accept, decline, cancel and leave, from the agent's side. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AgentInvitationServiceImplTest {

    private static final String SUB = "sub-me";
    private static final String EMAIL = "me@example.com";

    @Mock private MyPlayerAccess myPlayerAccess;
    @Mock private PersonRepository personRepository;
    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private ClubRepository clubRepository;
    @Mock private LinkInvitations linkInvitations;
    @Mock private LinkAttemptLimiter limiter;
    @Mock private AgentInvitationEmailService emailService;

    private AgentInvitationServiceImpl service;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken(SUB, null, List.of());
    private final UUID clubId = UUID.randomUUID();
    private Person me;
    private Person child;
    private PlayerProfile profile;

    @BeforeEach
    void setUp() {
        service = new AgentInvitationServiceImpl(myPlayerAccess, personRepository, personLinkRepository, clubRepository,
                linkInvitations, limiter, emailService);
        me = Person.builder().id(UUID.randomUUID()).firstName("Me").lastName("Mine").email(EMAIL)
                .status(PersonStatus.ACTIVE).build();
        child = Person.builder().id(UUID.randomUUID()).firstName("Sam").lastName("Smith")
                .dateOfBirth(LocalDate.of(2012, 6, 15)).build();
        profile = PlayerProfile.builder().id(UUID.randomUUID()).personId(child.getId()).clubId(clubId).active(true).build();
        when(personRepository.findByKeycloakUserId(SUB)).thenReturn(Optional.of(me));
        when(linkInvitations.create(any(), any(), any(), anyBool(), any(), any(), any())).thenAnswer(i ->
                PersonLink.builder().id(UUID.randomUUID()).status(PersonLinkStatus.INVITED).build());
    }

    private static boolean anyBool() {
        return org.mockito.ArgumentMatchers.anyBoolean();
    }

    private Jwt jwt(boolean verified) {
        return Jwt.withTokenValue("t").header("alg", "none").subject(SUB).issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60)).claim("email", EMAIL).claim("email_verified", verified).build();
    }

    private PersonLink linkOf(Person account, PersonLinkStatus status, boolean main) {
        return PersonLink.builder().id(UUID.randomUUID()).accountPersonId(account == null ? null : account.getId())
                .subjectPersonId(child.getId()).clubId(clubId).status(status).main(main)
                .createdAt(Instant.now()).build();
    }

    private HeldPlayer held(boolean main) {
        PersonLink link = linkOf(me, PersonLinkStatus.ACTIVE, main);
        HeldPlayer held = new HeldPlayer(link.getId().toString(), me, child, profile, link);
        when(myPlayerAccess.resolve(auth, held.key())).thenReturn(held);
        return held;
    }

    private PersonLink openInvitationForMe(boolean makeMain) {
        PersonLink invitation = PersonLink.builder().id(UUID.randomUUID()).invitedEmail(EMAIL)
                .subjectPersonId(child.getId()).clubId(clubId).status(PersonLinkStatus.INVITED).makeMain(makeMain)
                .grantedVia(LinkGrantedVia.AGENT_INVITE).createdAt(Instant.now()).build();
        when(personLinkRepository.findOpenInvitationsForEmail(eq(EMAIL), any())).thenReturn(List.of(invitation));
        return invitation;
    }

    // ---- invite ----

    @Test
    void theMainAgentInvitesAnEmailAndTheEmailIsSentAfterTheInvitationIsCreated() {
        HeldPlayer held = held(true);

        service.invite(auth, jwt(true), held.key(), new InviteAgentRequest("new@example.com", AgentInviteMode.HANDOVER));

        verify(limiter).countInvite(me.getId());
        InOrder order = inOrder(linkInvitations, emailService);
        order.verify(linkInvitations).create(child.getId(), clubId, "new@example.com", true, LinkGrantedVia.AGENT_INVITE,
                me.getId(), EMAIL);
        order.verify(emailService).sendAfterCommit(any());
    }

    @Test
    void addModeIsNotAHandOver() {
        HeldPlayer held = held(true);

        service.invite(auth, jwt(true), held.key(), new InviteAgentRequest("new@example.com", AgentInviteMode.ADD));

        verify(linkInvitations).create(child.getId(), clubId, "new@example.com", false, LinkGrantedVia.AGENT_INVITE,
                me.getId(), EMAIL);
    }

    @Test
    void aNonMainAgentCannotInviteOrHandOver() {
        HeldPlayer held = held(false);

        assertThatThrownBy(() -> service.invite(auth, jwt(true), held.key(),
                new InviteAgentRequest("new@example.com", AgentInviteMode.HANDOVER))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(limiter, linkInvitations, emailService);
    }

    @Test
    void aMinorsOwnRecordCannotInviteButAnAdultPlayerCan() {
        Person minor = Person.builder().id(UUID.randomUUID()).firstName("Mia").dateOfBirth(LocalDate.now().minusYears(12)).build();
        HeldPlayer minorSelf = new HeldPlayer("self:1", me, minor, profile, null);
        when(myPlayerAccess.resolve(auth, "self:1")).thenReturn(minorSelf);
        assertThatThrownBy(() -> service.invite(auth, jwt(true), "self:1",
                new InviteAgentRequest("new@example.com", AgentInviteMode.ADD))).isInstanceOf(AccessDeniedException.class);

        Person adult = Person.builder().id(UUID.randomUUID()).firstName("Al").dateOfBirth(LocalDate.of(1990, 1, 1)).build();
        HeldPlayer adultSelf = new HeldPlayer("self:2", me, adult, profile, null);
        when(myPlayerAccess.resolve(auth, "self:2")).thenReturn(adultSelf);
        service.invite(auth, jwt(true), "self:2", new InviteAgentRequest("new@example.com", AgentInviteMode.ADD));
        verify(linkInvitations).create(eq(adult.getId()), any(), any(), anyBool(), any(), any(), any());
    }

    @Test
    void theFifthInvitationADayIsFineAndTheSixthIs429WithNothingCreated() {
        HeldPlayer held = held(true);
        org.mockito.Mockito.doThrow(new LinkRateLimitedException(60)).when(limiter).countInvite(me.getId());

        assertThatThrownBy(() -> service.invite(auth, jwt(true), held.key(),
                new InviteAgentRequest("new@example.com", AgentInviteMode.ADD))).isInstanceOf(LinkRateLimitedException.class);
        verify(linkInvitations, never()).create(any(), any(), any(), anyBool(), any(), any(), any());
        verify(emailService, never()).sendAfterCommit(any());
    }

    @Test
    void inviteNeedsAVerifiedEmail() {
        assertThatThrownBy(() -> service.invite(auth, jwt(false), "k", new InviteAgentRequest("a@b.co", AgentInviteMode.ADD)))
                .isInstanceOf(EmailNotVerifiedException.class);
    }

    // ---- accept ----

    @Test
    void acceptingAHandOverStepsThePreviousMainDownFirstAndMakesTheCallerMain() {
        PersonLink invitation = openInvitationForMe(true);
        Person oldMainAccount = Person.builder().id(UUID.randomUUID()).build();
        PersonLink oldMain = linkOf(oldMainAccount, PersonLinkStatus.ACTIVE, true);
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(oldMain));

        service.accept(auth, jwt(true), invitation.getId());

        InOrder order = inOrder(personLinkRepository);
        order.verify(personLinkRepository).saveAndFlush(oldMain);
        order.verify(personLinkRepository).saveAndFlush(invitation);
        assertThat(oldMain.isMain()).isFalse();
        assertThat(invitation.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        assertThat(invitation.isMain()).isTrue();
        assertThat(invitation.getAccountPersonId()).isEqualTo(me.getId());
        assertThat(invitation.isMakeMain()).isFalse();
        assertThat(invitation.getDecidedAt()).isNotNull();
    }

    @Test
    void acceptingAnAddWhileAnotherAgentIsMainKeepsThemMain() {
        PersonLink invitation = openInvitationForMe(false);
        Person mainAccount = Person.builder().id(UUID.randomUUID()).build();
        PersonLink main = linkOf(mainAccount, PersonLinkStatus.ACTIVE, true);
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(main));

        service.accept(auth, jwt(true), invitation.getId());

        assertThat(main.isMain()).isTrue();
        assertThat(invitation.isMain()).isFalse();
        assertThat(invitation.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        verify(personLinkRepository, times(1)).saveAndFlush(any());
    }

    @Test
    void acceptingAnAddForAPlayerWithNoMainAgentMakesTheCallerMain() {
        PersonLink invitation = openInvitationForMe(false);
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of());

        service.accept(auth, jwt(true), invitation.getId());

        assertThat(invitation.isMain()).isTrue();
    }

    @Test
    void anInvitationForAnotherEmailOrAnExpiredOneIsNotFound() {
        // the repository query is what filters by the caller's verified email and by expiry; nothing comes back
        when(personLinkRepository.findOpenInvitationsForEmail(eq(EMAIL), any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.accept(auth, jwt(true), UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.decline(auth, jwt(true), UUID.randomUUID())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anUnverifiedEmailCannotAccept() {
        assertThatThrownBy(() -> service.accept(auth, jwt(false), UUID.randomUUID()))
                .isInstanceOf(EmailNotVerifiedException.class);
    }

    @Test
    void aLostRaceOnTheOneMainIndexIsAConflict() {
        PersonLink invitation = openInvitationForMe(true);
        when(personLinkRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("ux_person_link_one_main"));

        assertThatThrownBy(() -> service.accept(auth, jwt(true), invitation.getId())).isInstanceOf(ConflictException.class);
    }

    @Test
    void thePlayerCannotAcceptBeingTheirOwnAgentAndAnExistingAgentCannotAcceptTwice() {
        PersonLink invitation = openInvitationForMe(false);
        invitation.setSubjectPersonId(me.getId());
        assertThatThrownBy(() -> service.accept(auth, jwt(true), invitation.getId())).isInstanceOf(ValidationException.class);

        invitation.setSubjectPersonId(child.getId());
        when(personLinkRepository.findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                        eq(me.getId()), eq(child.getId()), eq(clubId), any()))
                .thenReturn(Optional.of(linkOf(me, PersonLinkStatus.ACTIVE, false)));
        assertThatThrownBy(() -> service.accept(auth, jwt(true), invitation.getId())).isInstanceOf(ConflictException.class);
    }

    @Test
    void decliningMarksTheInvitationDeclinedAndNobodyIsLinked() {
        PersonLink invitation = openInvitationForMe(true);

        service.decline(auth, jwt(true), invitation.getId());

        assertThat(invitation.getStatus()).isEqualTo(PersonLinkStatus.DECLINED);
        assertThat(invitation.getAccountPersonId()).isNull();
    }

    // ---- remove: cancel and leave ----

    @Test
    void theSenderCancelsAnOpenInvitationButAnotherPersonCannot() {
        PersonLink invitation = linkOf(null, PersonLinkStatus.INVITED, false);
        invitation.setInvitedEmail("x@example.com");
        invitation.setGrantedByPersonId(me.getId());
        when(personLinkRepository.findById(invitation.getId())).thenReturn(Optional.of(invitation));

        service.remove(auth, invitation.getId());
        assertThat(invitation.getStatus()).isEqualTo(PersonLinkStatus.REVOKED);
        assertThat(invitation.getRevokedByPersonId()).isEqualTo(me.getId());

        PersonLink notMine = linkOf(null, PersonLinkStatus.INVITED, false);
        notMine.setGrantedByPersonId(UUID.randomUUID());
        when(personLinkRepository.findById(notMine.getId())).thenReturn(Optional.of(notMine));
        assertThatThrownBy(() -> service.remove(auth, notMine.getId())).isInstanceOf(NotFoundException.class);
        assertThat(notMine.getStatus()).isEqualTo(PersonLinkStatus.INVITED);
    }

    @Test
    void anOrdinaryAgentLeavesAndNobodyIsPromoted() {
        PersonLink mine = linkOf(me, PersonLinkStatus.ACTIVE, false);
        when(personLinkRepository.findById(mine.getId())).thenReturn(Optional.of(mine));

        service.remove(auth, mine.getId());

        assertThat(mine.getStatus()).isEqualTo(PersonLinkStatus.REVOKED);
        verify(personLinkRepository, times(1)).save(mine);
        verify(personLinkRepository, never()).saveAndFlush(any());
        verify(personLinkRepository, never()).findActiveBySubjectAndClub(any(), any());
    }

    @Test
    void aMainAgentCannotLeaveWhileOtherAgentsExistButCanWhenAlone() {
        PersonLink mine = linkOf(me, PersonLinkStatus.ACTIVE, true);
        PersonLink other = linkOf(Person.builder().id(UUID.randomUUID()).build(), PersonLinkStatus.ACTIVE, false);
        when(personLinkRepository.findById(mine.getId())).thenReturn(Optional.of(mine));
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(mine, other));

        assertThatThrownBy(() -> service.remove(auth, mine.getId())).isInstanceOf(ConflictException.class);
        assertThat(mine.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);

        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(mine));
        service.remove(auth, mine.getId());
        assertThat(mine.getStatus()).isEqualTo(PersonLinkStatus.REVOKED);
        assertThat(mine.isMain()).isFalse();
    }

    @Test
    void anotherAccountsActiveLinkAndAnUnknownLinkAreNotFound() {
        PersonLink theirs = linkOf(Person.builder().id(UUID.randomUUID()).build(), PersonLinkStatus.ACTIVE, false);
        when(personLinkRepository.findById(theirs.getId())).thenReturn(Optional.of(theirs));

        assertThatThrownBy(() -> service.remove(auth, theirs.getId())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.remove(auth, UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        assertThat(theirs.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
    }

    @Test
    void aSuspendedCallerCannotAcceptOrLeave() {
        me.setStatus(PersonStatus.SUSPENDED);

        assertThatThrownBy(() -> service.remove(auth, UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.accept(auth, jwt(true), UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);
    }
}
