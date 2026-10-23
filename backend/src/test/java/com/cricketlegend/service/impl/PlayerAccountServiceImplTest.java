package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerAccountDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.AgentInvitationEmailService;
import com.cricketlegend.service.support.LinkInvitations;
import com.cricketlegend.service.support.PlayerSectionNames;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;

/**
 * docs/specs/119: "Players and their main agent" for the manager (masked emails, section scope) and the club's remove,
 * make-main and invite-as-main, all of which need confirm true and a player the caller may administer.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlayerAccountServiceImplTest {

    @Mock private PlayerProfileRepository playerProfileRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private PlayerSectionNames playerSectionNames;
    @Mock private AccessService accessService;
    @Mock private LinkInvitations linkInvitations;
    @Mock private AgentInvitationEmailService agentInvitationEmailService;

    private PlayerAccountServiceImpl service;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken("mgr", null, List.of());
    private final UUID clubId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private final Map<UUID, Person> people = new HashMap<>();
    private Person child;
    private PlayerProfile profile;

    @BeforeEach
    void setUp() {
        service = new PlayerAccountServiceImpl(playerProfileRepository, personRepository, personLinkRepository,
                playerSectionNames, new LinkRequestMapper(), accessService, linkInvitations, agentInvitationEmailService);
        child = person("Sam", "Smith", null);
        profile = PlayerProfile.builder().id(UUID.randomUUID()).personId(child.getId()).clubId(clubId).active(true).build();
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(actorId);
        when(accessService.accessibleSectionIds(auth, clubId)).thenReturn(Optional.empty());
        when(playerSectionNames.sectionIds(any())).thenReturn(Map.of());
        when(playerSectionNames.firstNames(any())).thenReturn(Map.of());
        when(personRepository.findAllById(any())).thenAnswer(i -> {
            List<Person> found = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (people.containsKey(id)) {
                    found.add(people.get(id));
                }
            }
            return found;
        });
    }

    private Person person(String first, String last, String email) {
        Person p = Person.builder().id(UUID.randomUUID()).firstName(first).lastName(last).email(email).build();
        people.put(p.getId(), p);
        return p;
    }

    private PersonLink link(Person account, PersonLinkStatus status, boolean main) {
        PersonLink l = PersonLink.builder().id(UUID.randomUUID()).accountPersonId(account == null ? null : account.getId())
                .subjectPersonId(child.getId()).clubId(clubId).status(status).main(main)
                .grantedVia(LinkGrantedVia.EMAIL_MATCH).createdAt(java.time.Instant.now()).build();
        when(personLinkRepository.findById(l.getId())).thenReturn(Optional.of(l));
        return l;
    }

    // ---- list ----

    @Test
    void theListShowsTheMainAgentByNameAndMaskedEmailOnlyWithTheOtherAgentCount() {
        Person main = person("Olga", "Other", "olga@example.org");
        Person second = person("Sec", "Ond", "sec@example.org");
        PersonLink mainLink = link(main, PersonLinkStatus.ACTIVE, true);
        PersonLink secondLink = link(second, PersonLinkStatus.ACTIVE, false);
        when(playerProfileRepository.searchForAccounts(any(), anyBoolean(), any(), anyBoolean(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(profile), PageRequest.of(0, 20), 1));
        when(personLinkRepository.findActiveBySubjectsAndClub(any(), eq(clubId))).thenReturn(List.of(mainLink, secondLink));

        PlayerAccountDto row = service.list(auth, clubId, null, false, null, 0, 20).getContent().get(0);

        assertThat(row.mainAgentName()).isEqualTo("Olga Other");
        assertThat(row.mainAgentMaskedEmail()).isEqualTo("o***@example.org");
        assertThat(row.otherAgentCount()).isEqualTo(1);
        assertThat(row.toString()).doesNotContain("olga@example.org").doesNotContain("sec@example.org");
    }

    @Test
    void aClubWideCallerIsNotRestrictedBySectionAndASectionScopedCallerIsRestrictedToTheirs() {
        when(playerProfileRepository.searchForAccounts(any(), anyBoolean(), any(), anyBoolean(), any(), any()))
                .thenReturn(Page.empty());

        service.list(auth, clubId, null, false, "  Sam ", 0, 20);
        verify(playerProfileRepository).searchForAccounts(eq(clubId), eq(false), any(), eq(false), eq("%sam%"), any());

        UUID mine = UUID.randomUUID();
        when(accessService.accessibleSectionIds(auth, clubId)).thenReturn(Optional.of(Set.of(mine)));
        service.list(auth, clubId, null, true, null, 0, 20);
        verify(playerProfileRepository).searchForAccounts(eq(clubId), eq(true), eq(Set.of(mine)), eq(true), eq("%%"), any());
    }

    @Test
    void aSectionFilterNeedsAdministeringThatSectionAndNarrowsTheScope() {
        UUID mine = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        when(accessService.accessibleSectionIds(auth, clubId)).thenReturn(Optional.of(Set.of(mine)));
        when(accessService.sectionAndDescendantIds(clubId, other)).thenReturn(Set.of(other));
        org.mockito.Mockito.doThrow(new AccessDeniedException("no")).when(accessService)
                .assertCanAdministerSection(auth, clubId, other);

        assertThatThrownBy(() -> service.list(auth, clubId, other, false, null, 0, 20))
                .isInstanceOf(AccessDeniedException.class);
        verify(playerProfileRepository, never()).searchForAccounts(any(), anyBoolean(), any(), anyBoolean(), any(), any());
    }

    @Test
    void anOutOfRangePageOrSizeIsRefused() {
        assertThatThrownBy(() -> service.list(auth, clubId, null, false, null, -1, 20)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.list(auth, clubId, null, false, null, 0, 0)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.list(auth, clubId, null, false, null, 0, 101)).isInstanceOf(ValidationException.class);
    }

    // ---- links of one player ----

    @Test
    void aPlayerOfAnotherClubIsNotFoundAndAPlayerOutsideTheCallersSectionsIsForbidden() {
        PlayerProfile elsewhere = PlayerProfile.builder().id(UUID.randomUUID()).personId(child.getId())
                .clubId(UUID.randomUUID()).active(true).build();
        when(playerProfileRepository.findById(elsewhere.getId())).thenReturn(Optional.of(elsewhere));
        assertThatThrownBy(() -> service.links(auth, clubId, elsewhere.getId())).isInstanceOf(NotFoundException.class);

        org.mockito.Mockito.doThrow(new AccessDeniedException("no")).when(accessService)
                .assertCanAdministerAnySection(any(), eq(clubId), any());
        assertThatThrownBy(() -> service.links(auth, clubId, profile.getId())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void linksListTheMainAgentFirstWithMaskedEmailsAndInvitationsByMaskedInvitedEmail() {
        Person main = person("Olga", "Other", "olga@example.org");
        PersonLink mainLink = link(main, PersonLinkStatus.ACTIVE, true);
        PersonLink invitation = link(null, PersonLinkStatus.INVITED, false);
        invitation.setInvitedEmail("guest@example.net");
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(mainLink));
        when(personLinkRepository.findOpenInvitationsBySubjectAndClub(eq(child.getId()), eq(clubId), any()))
                .thenReturn(List.of(invitation));

        var links = service.links(auth, clubId, profile.getId());

        assertThat(links).extracting(l -> l.maskedEmail()).containsExactly("o***@example.org", "g***@example.net");
        assertThat(links.toString()).doesNotContain("olga@example.org").doesNotContain("guest@example.net");
    }

    // ---- remove ----

    @Test
    void removingAnAgentNeedsConfirmTrue() {
        PersonLink l = link(person("A", "B", "a@b.co"), PersonLinkStatus.ACTIVE, false);

        assertThatThrownBy(() -> service.revokeLink(auth, clubId, profile.getId(), l.getId(), false))
                .isInstanceOf(ValidationException.class);
        assertThat(l.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        verifyNoInteractions(playerProfileRepository);
    }

    @Test
    void removingRevokesTheLinkDropsMainAndRecordsWho() {
        PersonLink l = link(person("A", "B", "a@b.co"), PersonLinkStatus.ACTIVE, true);

        service.revokeLink(auth, clubId, profile.getId(), l.getId(), true);

        assertThat(l.getStatus()).isEqualTo(PersonLinkStatus.REVOKED);
        assertThat(l.isMain()).isFalse();
        assertThat(l.getRevokedByPersonId()).isEqualTo(actorId);
        assertThat(l.getRevokedAt()).isNotNull();
    }

    @Test
    void aLinkOfAnotherPlayerOrAnAlreadyRevokedLinkIsNotFound() {
        Person otherKid = person("Other", "Kid", null);
        PersonLink foreign = PersonLink.builder().id(UUID.randomUUID()).subjectPersonId(otherKid.getId()).clubId(clubId)
                .status(PersonLinkStatus.ACTIVE).build();
        when(personLinkRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));
        PersonLink revoked = link(person("A", "B", "a@b.co"), PersonLinkStatus.REVOKED, false);

        assertThatThrownBy(() -> service.revokeLink(auth, clubId, profile.getId(), foreign.getId(), true))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.revokeLink(auth, clubId, profile.getId(), revoked.getId(), true))
                .isInstanceOf(NotFoundException.class);
        assertThat(foreign.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
    }

    // ---- make main ----

    @Test
    void makeMainNeedsConfirmTrue() {
        PersonLink l = link(person("A", "B", "a@b.co"), PersonLinkStatus.ACTIVE, false);

        for (Boolean confirm : new Boolean[] {false, null}) {
            assertThatThrownBy(() -> service.makeMain(auth, clubId, profile.getId(), l.getId(), confirm))
                    .isInstanceOf(ValidationException.class);
        }
        assertThat(l.isMain()).isFalse();
    }

    @Test
    void makeMainStepsTheOldMainDownAndFlushesBeforeTheNewMainIsSaved() {
        PersonLink oldMain = link(person("Old", "Main", "o@b.co"), PersonLinkStatus.ACTIVE, true);
        PersonLink next = link(person("New", "Main", "n@b.co"), PersonLinkStatus.ACTIVE, false);
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(oldMain, next));

        service.makeMain(auth, clubId, profile.getId(), next.getId(), true);

        InOrder order = inOrder(personLinkRepository);
        order.verify(personLinkRepository).saveAndFlush(oldMain);
        order.verify(personLinkRepository).saveAndFlush(next);
        assertThat(oldMain.isMain()).isFalse();
        assertThat(next.isMain()).isTrue();
    }

    @Test
    void makeMainOnTheCurrentMainOrAnInactiveLinkIsRefusedAndALostRaceIsAConflict() {
        PersonLink main = link(person("A", "B", "a@b.co"), PersonLinkStatus.ACTIVE, true);
        assertThatThrownBy(() -> service.makeMain(auth, clubId, profile.getId(), main.getId(), true))
                .isInstanceOf(ConflictException.class);

        PersonLink invited = link(null, PersonLinkStatus.INVITED, false);
        assertThatThrownBy(() -> service.makeMain(auth, clubId, profile.getId(), invited.getId(), true))
                .isInstanceOf(NotFoundException.class);

        PersonLink next = link(person("N", "M", "n@b.co"), PersonLinkStatus.ACTIVE, false);
        when(personLinkRepository.findActiveBySubjectAndClub(child.getId(), clubId)).thenReturn(List.of(next));
        when(personLinkRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("ux"));
        assertThatThrownBy(() -> service.makeMain(auth, clubId, profile.getId(), next.getId(), true))
                .isInstanceOf(ConflictException.class);
    }

    // ---- invite as main ----

    @Test
    void inviteAsMainNeedsConfirmTrueAndCreatesAMakeMainClubManagerInvitationThenSendsTheEmail() {
        assertThatThrownBy(() -> service.inviteMain(auth, clubId, profile.getId(), "x@example.com", false))
                .isInstanceOf(ValidationException.class);
        verifyNoInteractions(linkInvitations, agentInvitationEmailService);

        PersonLink created = PersonLink.builder().id(UUID.randomUUID()).build();
        when(linkInvitations.create(any(), any(), any(), anyBoolean(), any(), any(), any())).thenReturn(created);

        service.inviteMain(auth, clubId, profile.getId(), "x@example.com", true);

        InOrder order = inOrder(linkInvitations, agentInvitationEmailService);
        order.verify(linkInvitations).create(child.getId(), clubId, "x@example.com", true, LinkGrantedVia.CLUB_MANAGER,
                actorId, null);
        order.verify(agentInvitationEmailService).sendAfterCommit(created.getId());
    }

    @Test
    void aManagerWhoCannotAdministerThePlayerCannotChangeAgents() {
        PersonLink l = link(person("A", "B", "a@b.co"), PersonLinkStatus.ACTIVE, false);
        org.mockito.Mockito.doThrow(new AccessDeniedException("no")).when(accessService)
                .assertCanAdministerAnySection(any(), eq(clubId), any());

        assertThatThrownBy(() -> service.revokeLink(auth, clubId, profile.getId(), l.getId(), true))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.makeMain(auth, clubId, profile.getId(), l.getId(), true))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.inviteMain(auth, clubId, profile.getId(), "x@example.com", true))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(l.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        verifyNoInteractions(linkInvitations);
    }
}
