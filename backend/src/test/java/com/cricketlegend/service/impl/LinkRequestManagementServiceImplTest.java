package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.LinkGrantedVia;
import com.cricketlegend.domain.LinkRequest;
import com.cricketlegend.domain.LinkRequestStatus;
import com.cricketlegend.domain.MainAgentMode;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.ApproveLinkRequestRequest;
import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.DeclineLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestDto;
import com.cricketlegend.dto.NewLinkedPlayerRequest;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LinkRequestMapper;
import com.cricketlegend.repository.LinkRequestRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.LinkRequestOutcomeEmailService;
import com.cricketlegend.service.PlayerSectionService;
import com.cricketlegend.service.PlayerService;
import com.cricketlegend.service.support.LinkRequestSuggester;
import com.cricketlegend.service.support.LinkRequestSuggester.Suggestion;
import com.cricketlegend.service.support.PlayerSectionNames;
import java.lang.reflect.Method;
import java.time.LocalDate;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/119 slice 3 Test Plan, the manager side of link requests: approve needs confirm, "new player" creates the
 * player and the main-agent link together, decline stores the note, a section scoped manager sees and decides only
 * requests in their sections, and the outcome email is requested only after the decision is saved.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LinkRequestManagementServiceImplTest {

    @Mock private LinkRequestRepository linkRequestRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PlayerProfileRepository playerProfileRepository;
    @Mock private PersonLinkRepository personLinkRepository;
    @Mock private PlayerService playerService;
    @Mock private PlayerSectionService playerSectionService;
    @Mock private PlayerSectionNames playerSectionNames;
    @Mock private LinkRequestSuggester suggester;
    @Mock private LinkRequestOutcomeEmailService outcomeEmailService;
    @Mock private AccessService accessService;

    private LinkRequestManagementServiceImpl service;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken("manager-sub", null, List.of());
    private final UUID clubId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private final Map<UUID, Person> people = new HashMap<>();
    private Person requester;
    private LinkRequest request;

    @BeforeEach
    void setUp() {
        service = new LinkRequestManagementServiceImpl(linkRequestRepository, personRepository, playerProfileRepository,
                personLinkRepository, playerService, playerSectionService, playerSectionNames, suggester,
                new LinkRequestMapper(), outcomeEmailService, accessService);
        requester = person("Pat", "Parent");
        request = pending(requester);
        when(accessService.resolveCurrentPersonId(auth)).thenReturn(actorId);
        when(accessService.accessibleSectionIds(auth, clubId)).thenReturn(Optional.empty());
        when(linkRequestRepository.findByIdAndClubId(request.getId(), clubId)).thenReturn(Optional.of(request));
        when(linkRequestRepository.findByClubIdAndStatusOrderByCreatedAtAsc(any(), any())).thenReturn(List.of(request));
        when(linkRequestRepository.claim(any(), any(), any(), any(), any())).thenReturn(1);
        when(playerSectionNames.sectionIds(any())).thenReturn(Map.of());
        when(suggester.suggest(any(), any(), any())).thenReturn(Map.of());
        when(personLinkRepository.findActiveBySubjectAndClub(any(), any())).thenReturn(List.of());
        when(personLinkRepository.findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(any(), any(), any(), any()))
                .thenReturn(Optional.empty());
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

    private Person person(String first, String last) {
        Person p = Person.builder().id(UUID.randomUUID()).firstName(first).lastName(last)
                .email(first.toLowerCase() + "@example.com").dateOfBirth(LocalDate.of(2012, 6, 15)).build();
        people.put(p.getId(), p);
        return p;
    }

    private LinkRequest pending(Person by) {
        return LinkRequest.builder().id(UUID.randomUUID()).clubId(clubId).accountPersonId(by.getId())
                .typedFirstName("Sam").typedLastName("Smith").typedDateOfBirth(LocalDate.of(2012, 6, 15))
                .contactNumber("0821234567").status(LinkRequestStatus.PENDING).build();
    }

    private PlayerProfile existingPlayer(Person subject) {
        PlayerProfile profile = PlayerProfile.builder().id(UUID.randomUUID()).personId(subject.getId()).clubId(clubId)
                .active(true).build();
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        return profile;
    }

    private PersonLink activeLink(Person account, Person subject, boolean main) {
        return PersonLink.builder().id(UUID.randomUUID()).accountPersonId(account.getId()).subjectPersonId(subject.getId())
                .clubId(clubId).status(PersonLinkStatus.ACTIVE).main(main).grantedVia(LinkGrantedVia.EMAIL_MATCH).build();
    }

    private ApproveLinkRequestRequest approveExisting(PlayerProfile profile, MainAgentMode mode, Boolean confirm) {
        return new ApproveLinkRequestRequest(profile.getId(), null, mode, confirm);
    }

    // ---- approve ----

    @Test
    void approveNeedsConfirmTrueAndTouchesNothingWithoutIt() {
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);

        for (Boolean confirm : new Boolean[] {false, null}) {
            assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                    approveExisting(profile, MainAgentMode.ADD, confirm))).isInstanceOf(ValidationException.class);
        }
        verifyNoInteractions(linkRequestRepository, personLinkRepository, outcomeEmailService);
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.PENDING);
    }

    @Test
    void approveNeedsExactlyOneOfExistingPlayerOrNewPlayer() {
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);
        NewLinkedPlayerRequest np = new NewLinkedPlayerRequest("Sam", "Smith", LocalDate.of(2012, 6, 15), null);

        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                new ApproveLinkRequestRequest(profile.getId(), np, MainAgentMode.ADD, true)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                new ApproveLinkRequestRequest(null, null, MainAgentMode.ADD, true)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void approvingAnExistingPlayerWithNoMainAgentMakesTheRequesterMainAndRecordsTheDecision() {
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);

        service.approve(auth, clubId, request.getId(), approveExisting(profile, MainAgentMode.ADD, true));

        ArgumentCaptor<PersonLink> saved = ArgumentCaptor.forClass(PersonLink.class);
        verify(personLinkRepository).saveAndFlush(saved.capture());
        PersonLink link = saved.getValue();
        assertThat(link.getAccountPersonId()).isEqualTo(requester.getId());
        assertThat(link.getSubjectPersonId()).isEqualTo(kid.getId());
        assertThat(link.getStatus()).isEqualTo(PersonLinkStatus.ACTIVE);
        assertThat(link.isMain()).isTrue();
        assertThat(link.getGrantedVia()).isEqualTo(LinkGrantedVia.CLUB_APPROVAL);
        assertThat(link.getGrantedByPersonId()).isEqualTo(actorId);
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.APPROVED);
        assertThat(request.getResolvedSubjectPersonId()).isEqualTo(kid.getId());
        assertThat(request.getDecidedByPersonId()).isEqualTo(actorId);
        assertThat(request.getDecidedAt()).isNotNull();
    }

    @Test
    void addKeepsAnExistingMainAgentAndMakeMainStepsThemDownFirst() {
        Person kid = person("Sam", "Smith");
        Person oldMainAccount = person("Olga", "Old");
        PlayerProfile profile = existingPlayer(kid);
        PersonLink oldMain = activeLink(oldMainAccount, kid, true);
        when(personLinkRepository.findActiveBySubjectAndClub(kid.getId(), clubId)).thenReturn(List.of(oldMain));

        service.approve(auth, clubId, request.getId(), approveExisting(profile, MainAgentMode.ADD, true));
        ArgumentCaptor<PersonLink> added = ArgumentCaptor.forClass(PersonLink.class);
        verify(personLinkRepository).saveAndFlush(added.capture());
        assertThat(added.getValue().isMain()).isFalse();
        assertThat(oldMain.isMain()).isTrue();
    }

    @Test
    void makeMainStepsTheOldMainDownBeforeTheNewMainIsWritten() {
        Person kid = person("Sam", "Smith");
        Person oldMainAccount = person("Olga", "Old");
        PlayerProfile profile = existingPlayer(kid);
        PersonLink oldMain = activeLink(oldMainAccount, kid, true);
        when(personLinkRepository.findActiveBySubjectAndClub(kid.getId(), clubId)).thenReturn(List.of(oldMain));

        service.approve(auth, clubId, request.getId(), approveExisting(profile, MainAgentMode.MAKE_MAIN, true));

        InOrder order = inOrder(personLinkRepository);
        order.verify(personLinkRepository).saveAndFlush(oldMain);
        ArgumentCaptor<PersonLink> second = ArgumentCaptor.forClass(PersonLink.class);
        order.verify(personLinkRepository).saveAndFlush(second.capture());
        assertThat(oldMain.isMain()).isFalse();
        assertThat(second.getValue().getAccountPersonId()).isEqualTo(requester.getId());
        assertThat(second.getValue().isMain()).isTrue();
    }

    @Test
    void anAlreadyActiveMainAgentCannotBeApprovedAgain() {
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);
        PersonLink own = activeLink(requester, kid, true);
        when(personLinkRepository.findActiveBySubjectAndClub(kid.getId(), clubId)).thenReturn(List.of(own));
        when(personLinkRepository.findFirstByAccountPersonIdAndSubjectPersonIdAndClubIdAndStatusIn(
                        eq(requester.getId()), eq(kid.getId()), eq(clubId), any()))
                .thenReturn(Optional.of(own));

        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                approveExisting(profile, MainAgentMode.MAKE_MAIN, true))).isInstanceOf(ConflictException.class);
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.PENDING);
    }

    @Test
    void aLostRaceOnTheMainAgentIndexIsAConflictAndTheRequestStaysPending() {
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);
        when(personLinkRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("ux_person_link_one_main"));

        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                approveExisting(profile, MainAgentMode.ADD, true))).isInstanceOf(ConflictException.class);
        verify(linkRequestRepository, never()).save(any());
        verify(outcomeEmailService, never()).sendAfterCommit(any());
    }

    @Test
    void approvingNewPlayerCreatesThePlayerThenTheMainAgentLinkAndLinksTheSection() {
        UUID sectionId = UUID.randomUUID();
        UUID newPersonId = UUID.randomUUID();
        PlayerDto created = mock(PlayerDto.class);
        when(created.id()).thenReturn(UUID.randomUUID());
        when(created.personId()).thenReturn(newPersonId);
        when(playerService.create(eq(clubId), any(CreatePlayerRequest.class))).thenReturn(created);

        service.approve(auth, clubId, request.getId(), new ApproveLinkRequestRequest(
                null, new NewLinkedPlayerRequest(" Sam ", " Smith ", LocalDate.of(2012, 6, 15), sectionId),
                MainAgentMode.ADD, true));

        ArgumentCaptor<CreatePlayerRequest> body = ArgumentCaptor.forClass(CreatePlayerRequest.class);
        verify(playerService).create(eq(clubId), body.capture());
        assertThat(body.getValue().firstName()).isEqualTo("Sam");
        assertThat(body.getValue().lastName()).isEqualTo("Smith");
        assertThat(body.getValue().dateOfBirth()).isEqualTo(LocalDate.of(2012, 6, 15));
        verify(playerSectionService).link(clubId, created.id(), sectionId);
        verify(accessService).assertCanAdministerSection(auth, clubId, sectionId);
        ArgumentCaptor<PersonLink> link = ArgumentCaptor.forClass(PersonLink.class);
        verify(personLinkRepository).saveAndFlush(link.capture());
        assertThat(link.getValue().getSubjectPersonId()).isEqualTo(newPersonId);
        assertThat(link.getValue().isMain()).isTrue();
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.APPROVED);
        assertThat(request.getResolvedSubjectPersonId()).isEqualTo(newPersonId);
    }

    @Test
    void approveIsOneTransactionSoThePlayerAndTheLinkCommitOrRollBackTogether() throws Exception {
        Method approve = LinkRequestManagementServiceImpl.class.getMethod("approve",
                org.springframework.security.core.Authentication.class, UUID.class, UUID.class, ApproveLinkRequestRequest.class);
        Transactional tx = approve.getAnnotation(Transactional.class);
        assertThat(tx).isNotNull();
        assertThat(tx.readOnly()).isFalse();
    }

    @Test
    void theRequestersOwnPlayerRecordCannotBeLinkedToThemselves() {
        PlayerProfile own = existingPlayer(requester);

        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                approveExisting(own, MainAgentMode.ADD, true))).isInstanceOf(ValidationException.class);
    }

    @Test
    void anInactivePlayerAndAPlayerOfAnotherClubCannotBeLinked() {
        Person kid = person("Sam", "Smith");
        PlayerProfile inactive = existingPlayer(kid);
        inactive.setActive(false);
        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                approveExisting(inactive, MainAgentMode.ADD, true))).isInstanceOf(ValidationException.class);

        PlayerProfile other = existingPlayer(person("Zed", "Zulu"));
        other.setClubId(UUID.randomUUID());
        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                approveExisting(other, MainAgentMode.ADD, true))).isInstanceOf(NotFoundException.class);
    }

    @Test
    void approveCallsTheOutcomeEmailOnlyAfterTheRequestIsSaved() {
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);

        service.approve(auth, clubId, request.getId(), approveExisting(profile, MainAgentMode.ADD, true));

        InOrder order = inOrder(linkRequestRepository, outcomeEmailService);
        order.verify(linkRequestRepository).save(request);
        order.verify(outcomeEmailService).sendAfterCommit(request.getId());
    }

    @Test
    void theLoserOfADoubleDecisionGetsA409AndNoLinkNoSaveAndNoEmail() {
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);
        when(linkRequestRepository.claim(any(), any(), any(), any(), any())).thenReturn(0);

        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(), approveExisting(profile, MainAgentMode.ADD, true)))
                .isInstanceOf(InvalidStatusTransitionException.class);
        assertThatThrownBy(() -> service.decline(auth, clubId, request.getId(), new DeclineLinkRequestRequest("no")))
                .isInstanceOf(InvalidStatusTransitionException.class);

        verify(linkRequestRepository, never()).save(any());
        verifyNoInteractions(personLinkRepository, outcomeEmailService, playerService);
    }

    // ---- decline ----

    @Test
    void declineStoresTheTrimmedNoteAndWhoDecidedAndSendsTheEmailAfterSaving() {
        service.decline(auth, clubId, request.getId(), new DeclineLinkRequestRequest("  Please call the office.  "));

        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.DECLINED);
        assertThat(request.getDecisionNote()).isEqualTo("Please call the office.");
        assertThat(request.getDecidedByPersonId()).isEqualTo(actorId);
        InOrder order = inOrder(linkRequestRepository, outcomeEmailService);
        order.verify(linkRequestRepository).save(request);
        order.verify(outcomeEmailService).sendAfterCommit(request.getId());
        verifyNoInteractions(personLinkRepository);
    }

    @Test
    void declineWithABlankNoteOrNoBodyStoresNoNote() {
        service.decline(auth, clubId, request.getId(), null);
        assertThat(request.getDecisionNote()).isNull();
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.DECLINED);
    }

    @Test
    void aDecidedOrUnknownRequestCannotBeDecidedAgain() {
        request.setStatus(LinkRequestStatus.APPROVED);
        assertThatThrownBy(() -> service.decline(auth, clubId, request.getId(), null))
                .isInstanceOf(InvalidStatusTransitionException.class);
        assertThatThrownBy(() -> service.decline(auth, clubId, UUID.randomUUID(), null))
                .isInstanceOf(NotFoundException.class);
    }

    // ---- section scope ----

    @Test
    void aSectionScopedManagerCannotDecideARequestWithNoSuggestionInTheirSections() {
        UUID mySection = UUID.randomUUID();
        when(accessService.accessibleSectionIds(auth, clubId)).thenReturn(Optional.of(Set.of(mySection)));
        when(suggester.suggest(eq(clubId), any(), any())).thenReturn(Map.of()); // unresolved or out of section

        assertThatThrownBy(() -> service.decline(auth, clubId, request.getId(), null))
                .isInstanceOf(AccessDeniedException.class);
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);
        assertThatThrownBy(() -> service.approve(auth, clubId, request.getId(),
                approveExisting(profile, MainAgentMode.ADD, true))).isInstanceOf(AccessDeniedException.class);
        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.PENDING);
        verify(outcomeEmailService, never()).sendAfterCommit(any());
    }

    @Test
    void aSectionScopedManagerCanDecideARequestWhoseSuggestionIsInTheirSection() {
        UUID mySection = UUID.randomUUID();
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);
        when(accessService.accessibleSectionIds(auth, clubId)).thenReturn(Optional.of(Set.of(mySection)));
        when(suggester.suggest(eq(clubId), any(), any())).thenReturn(
                Map.of(request.getId(), new Suggestion(profile, kid, Set.of(mySection), true)));

        service.decline(auth, clubId, request.getId(), null);

        assertThat(request.getStatus()).isEqualTo(LinkRequestStatus.DECLINED);
    }

    @Test
    void listAndSummaryShowASectionScopedManagerOnlyTheirRequestsAndAClubWideManagerEverything() {
        UUID mySection = UUID.randomUUID();
        Person otherRequester = person("Quinn", "Query");
        LinkRequest outOfSection = pending(otherRequester);
        when(linkRequestRepository.findByClubIdAndStatusOrderByCreatedAtAsc(clubId, LinkRequestStatus.PENDING))
                .thenReturn(List.of(request, outOfSection));
        Person kid = person("Sam", "Smith");
        PlayerProfile profile = existingPlayer(kid);

        // club wide: both, one of them unresolved
        when(suggester.suggest(any(), any(), any())).thenReturn(
                Map.of(request.getId(), new Suggestion(profile, kid, Set.of(mySection), true)));
        assertThat(service.summary(auth, clubId).waiting()).isEqualTo(2);
        assertThat(service.list(auth, clubId)).hasSize(2);

        // section scoped: only the one resolved inside their section
        when(accessService.accessibleSectionIds(auth, clubId)).thenReturn(Optional.of(Set.of(mySection)));
        assertThat(service.summary(auth, clubId).waiting()).isEqualTo(1);
        List<LinkRequestDto> visible = service.list(auth, clubId);
        assertThat(visible).extracting(LinkRequestDto::id).containsExactly(request.getId());
        assertThat(visible.get(0).suggestedPlayer().playerId()).isEqualTo(profile.getId());
        assertThat(visible.get(0).requesterEmail()).isEqualTo("pat@example.com");
        verify(suggester, times(4)).suggest(any(), any(), any());
    }
}
