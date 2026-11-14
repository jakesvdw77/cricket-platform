package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AccessRole;
import com.cricketlegend.domain.Permission;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.AccessGrantListDto;
import com.cricketlegend.dto.AddAccessGrantRequest;
import com.cricketlegend.dto.AddAccessGrantResultDto;
import com.cricketlegend.dto.ChangeAccessGrantRoleRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.exception.LinkRateLimitedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.AccessRoleRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.impl.AccessGrantServiceImpl;
import java.time.Instant;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;

/** docs/specs/150: the grant rules, one test per rule, against mocked collaborators. */
class AccessGrantServiceImplTest {

    private final AccessService accessService = mock(AccessService.class);
    private final RoleAssignmentRepository grantRepository = mock(RoleAssignmentRepository.class);
    private final AccessRoleRepository roleRepository = mock(AccessRoleRepository.class);
    private final AccessRoleService roleService = mock(AccessRoleService.class);
    private final PersonRepository personRepository = mock(PersonRepository.class);
    private final PersonService personService = mock(PersonService.class);
    private final SectionRepository sectionRepository = mock(SectionRepository.class);
    private final KeycloakProvisioningService keycloak = mock(KeycloakProvisioningService.class);
    private final AccessGrantEmailService emailService = mock(AccessGrantEmailService.class);

    private final UUID clubId = UUID.randomUUID();
    private final UUID otherClubId = UUID.randomUUID();
    private final UUID juniors = UUID.randomUUID();
    private final UUID seniors = UUID.randomUUID();
    private final UUID callerId = UUID.randomUUID();
    private final UUID viewerRoleId = UUID.randomUUID();
    private final TestingAuthenticationToken caller = new TestingAuthenticationToken("kc-caller", null);

    private AccessRole manager;
    private AccessRole viewer;
    private AccessGrantServiceImpl service;

    // What the caller holds: club-wide, or only inside the sections listed. Everything defaults to a club-wide Manager.
    private Set<Permission> heldClubWide = EnumSet.allOf(Permission.class);
    private Set<UUID> heldSections = Set.of();
    private Set<Permission> heldInSections = EnumSet.noneOf(Permission.class);

    @BeforeEach
    void setUp() {
        manager = role(AccessRole.MANAGER_ID, "MANAGER", "Manager", Permission.values());
        viewer = role(viewerRoleId, "VIEWER", "Viewer", Permission.PLAYERS_VIEW, Permission.MATCHES_VIEW, Permission.ACCESS_VIEW);
        service = new AccessGrantServiceImpl(
                accessService, grantRepository, roleRepository, roleService, personRepository, personService,
                sectionRepository, keycloak, emailService, 20);

        lenient().when(accessService.resolveCurrentPersonId(caller)).thenReturn(callerId);
        lenient().when(accessService.canClubWide(eq(caller), eq(clubId), any(Permission.class)))
                .thenAnswer(invocation -> heldClubWide.contains(invocation.<Permission>getArgument(2)));
        lenient().when(accessService.can(eq(caller), eq(clubId), any(Permission.class), any(UUID.class)))
                .thenAnswer(invocation -> heldClubWide.contains(invocation.<Permission>getArgument(2))
                        || (heldSections.contains(invocation.<UUID>getArgument(3))
                                && heldInSections.contains(invocation.<Permission>getArgument(2))));
        lenient().when(accessService.can(eq(caller), eq(clubId), any(Permission.class)))
                .thenAnswer(invocation -> heldClubWide.contains(invocation.<Permission>getArgument(2))
                        || (!heldSections.isEmpty() && heldInSections.contains(invocation.<Permission>getArgument(2))));
        lenient().when(accessService.sectionIdsFor(eq(caller), eq(clubId), any(Permission.class))).thenReturn(Optional.empty());
        lenient().when(accessService.sectionAndDescendantIds(eq(clubId), any(UUID.class)))
                .thenAnswer(invocation -> Set.of(invocation.<UUID>getArgument(1)));
        lenient().when(roleService.isAssignable(any(AccessRole.class))).thenReturn(true);
        lenient().when(roleRepository.findByClubIdIsNull()).thenReturn(List.of(manager, viewer));
        lenient().when(roleRepository.findById(AccessRole.MANAGER_ID)).thenReturn(Optional.of(manager));
        lenient().when(roleRepository.findById(viewerRoleId)).thenReturn(Optional.of(viewer));
        lenient().when(roleRepository.findAllById(any())).thenAnswer(invocation -> {
            Set<UUID> wanted = new HashSet<>();
            ((Iterable<UUID>) invocation.getArgument(0)).forEach(wanted::add);
            return List.of(manager, viewer).stream().filter(role -> wanted.contains(role.getId())).toList();
        });
        lenient().when(sectionRepository.findByClubId(clubId))
                .thenReturn(List.of(section(juniors, clubId), section(seniors, clubId)));
        lenient().when(sectionRepository.findById(juniors)).thenReturn(Optional.of(section(juniors, clubId)));
        lenient().when(sectionRepository.findById(seniors)).thenReturn(Optional.of(section(seniors, clubId)));
        UUID foreign = UUID.randomUUID();
        lenient().when(sectionRepository.findById(foreign)).thenReturn(Optional.of(section(foreign, otherClubId)));
        lenient().when(grantRepository.save(any(RoleAssignment.class))).thenAnswer(invocation -> {
            RoleAssignment saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(UUID.randomUUID());
            }
            return saved;
        });
        lenient().when(grantRepository.countInvitationsSince(eq(clubId), any(Instant.class))).thenReturn(0L);
        lenient().when(grantRepository.countClubWideManagers(clubId, AccessRole.MANAGER_ID)).thenReturn(2L);
        lenient().when(grantRepository.findByPersonId(any(UUID.class))).thenReturn(List.of());
        lenient().when(personRepository.findAllById(any())).thenReturn(List.of());
    }

    private static AccessRole role(UUID id, String key, String name, Permission... permissions) {
        AccessRole role = new AccessRole();
        ReflectionTestUtils.setField(role, "id", id);
        ReflectionTestUtils.setField(role, "key", key);
        ReflectionTestUtils.setField(role, "name", name);
        Set<String> names = new HashSet<>();
        for (Permission permission : permissions) {
            names.add(permission.name());
        }
        ReflectionTestUtils.setField(role, "permissionNames", names);
        return role;
    }

    private static Section section(UUID id, UUID club) {
        Section section = new Section();
        section.setId(id);
        section.setClubId(club);
        section.setName("Section");
        section.setActive(true);
        return section;
    }

    private Person person(UUID id, PersonStatus status, boolean hasAccount) {
        Person person = new Person();
        person.setId(id);
        person.setFirstName("Sam");
        person.setLastName("Smith");
        person.setEmail("sam@example.com");
        person.setStatus(status);
        if (hasAccount) {
            person.setKeycloakProvisionedAt(Instant.now());
        }
        return person;
    }

    private AddAccessGrantRequest request(UUID roleId, ScopeType scope, UUID sectionId) {
        return new AddAccessGrantRequest("Sam@Example.com ", "Sam", "Smith", roleId, scope, sectionId);
    }

    private RoleAssignment grant(UUID personId, UUID roleId, ScopeType scope, UUID scopeId) {
        return RoleAssignment.builder().id(UUID.randomUUID()).personId(personId).role(RoleAssignmentRole.CLUB_ADMIN)
                .accessRoleId(roleId).scopeType(scope).scopeId(scopeId).build();
    }

    private void callerIsSectionManagerOf(UUID section) {
        heldClubWide = EnumSet.noneOf(Permission.class);
        heldSections = Set.of(section);
        heldInSections = EnumSet.copyOf(
                Set.of(Permission.ACCESS_MANAGE, Permission.ACCESS_VIEW, Permission.PLAYERS_VIEW, Permission.MATCHES_VIEW));
    }

    // ------------------------------------------------------------------ add

    @Test
    void aNewPersonGetsAGrantAndAKeycloakInvitation() {
        Person sam = person(UUID.randomUUID(), PersonStatus.PENDING, false);
        when(personService.findOrCreatePerson("Sam", "Smith", "sam@example.com", null)).thenReturn(sam);

        AddAccessGrantResultDto result = service.add(caller, clubId, request(AccessRole.MANAGER_ID, ScopeType.CLUB, null));

        assertThat(result.accountExisted()).isFalse();
        assertThat(result.invitationSent()).isTrue();
        assertThat(result.invitationFailed()).isFalse();
        verify(keycloak).provisionAccount(sam);
        verify(personRepository).save(sam);
        verify(grantRepository, org.mockito.Mockito.atLeastOnce()).save(any(RoleAssignment.class));
    }

    @Test
    void everyGrantMadeHereKeepsTheLegacyClubAdminMarkerWhateverTheRole() {
        Person sam = person(UUID.randomUUID(), PersonStatus.ACTIVE, true);
        when(personService.findOrCreatePerson(any(), any(), any(), any())).thenReturn(sam);

        service.add(caller, clubId, request(viewerRoleId, ScopeType.SECTION, juniors));

        org.mockito.ArgumentCaptor<RoleAssignment> saved = org.mockito.ArgumentCaptor.forClass(RoleAssignment.class);
        verify(grantRepository).save(saved.capture());
        assertThat(saved.getValue().getRole()).isEqualTo(RoleAssignmentRole.CLUB_ADMIN);
        assertThat(saved.getValue().getAccessRoleId()).isEqualTo(viewerRoleId);
        assertThat(saved.getValue().getScopeType()).isEqualTo(ScopeType.SECTION);
        assertThat(saved.getValue().getScopeId()).isEqualTo(juniors);
        assertThat(saved.getValue().getGrantedByPersonId()).isEqualTo(callerId);
    }

    @Test
    void aPersonWhoAlreadyHasAnAccountGetsTheShortEmailAndNoNewAccount() {
        Person sam = person(UUID.randomUUID(), PersonStatus.ACTIVE, true);
        when(personService.findOrCreatePerson(any(), any(), any(), any())).thenReturn(sam);

        AddAccessGrantResultDto result = service.add(caller, clubId, request(viewerRoleId, ScopeType.CLUB, null));

        assertThat(result.accountExisted()).isTrue();
        assertThat(result.invitationSent()).isFalse();
        verify(keycloak, never()).provisionAccount(any());
        verify(emailService).sendAfterCommit(any(UUID.class));
    }

    @Test
    void aKeycloakFailureKeepsTheGrantAndSaysTheInvitationFailed() {
        Person sam = person(UUID.randomUUID(), PersonStatus.PENDING, false);
        when(personService.findOrCreatePerson(any(), any(), any(), any())).thenReturn(sam);
        doThrow(new KeycloakProvisioningException("down", new RuntimeException("down"))).when(keycloak).provisionAccount(sam);

        AddAccessGrantResultDto result = service.add(caller, clubId, request(viewerRoleId, ScopeType.CLUB, null));

        assertThat(result.invitationFailed()).isTrue();
        assertThat(result.invitationSent()).isFalse();
        verify(grantRepository).save(any(RoleAssignment.class));
    }

    @Test
    void aSectionManagerCannotGiveAccessOutsideTheirSection() {
        callerIsSectionManagerOf(juniors);

        assertThatThrownBy(() -> service.add(caller, clubId, request(viewerRoleId, ScopeType.SECTION, seniors)))
                .isInstanceOf(AccessDeniedException.class);
        verify(grantRepository, never()).save(any());
    }

    @Test
    void aSectionManagerCannotGiveAClubWideGrant() {
        callerIsSectionManagerOf(juniors);

        assertThatThrownBy(() -> service.add(caller, clubId, request(viewerRoleId, ScopeType.CLUB, null)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aCallerCannotGiveARoleWithAPermissionTheyDoNotHoldHere() {
        // A section Manager holds no Players Edit, so cannot hand out the Manager role in their own section.
        callerIsSectionManagerOf(juniors);

        assertThatThrownBy(() -> service.add(caller, clubId, request(AccessRole.MANAGER_ID, ScopeType.SECTION, juniors)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aSectionOfAnotherClubIsNotFound() {
        UUID foreign = UUID.randomUUID();
        when(sectionRepository.findById(foreign)).thenReturn(Optional.of(section(foreign, otherClubId)));

        assertThatThrownBy(() -> service.add(caller, clubId, request(viewerRoleId, ScopeType.SECTION, foreign)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void aRoleThatIsNotAssignableIsRefused() {
        when(roleService.isAssignable(viewer)).thenReturn(false);

        assertThatThrownBy(() -> service.add(caller, clubId, request(viewerRoleId, ScopeType.CLUB, null)))
                .isInstanceOf(com.cricketlegend.exception.ValidationException.class);
    }

    @Test
    void aGrantTheirExistingAccessAlreadyCoversIsRefused() {
        UUID samId = UUID.randomUUID();
        Person sam = person(samId, PersonStatus.ACTIVE, true);
        when(personService.findOrCreatePerson(any(), any(), any(), any())).thenReturn(sam);
        when(grantRepository.findByPersonId(samId))
                .thenReturn(List.of(grant(samId, AccessRole.MANAGER_ID, ScopeType.CLUB, clubId)));

        assertThatThrownBy(() -> service.add(caller, clubId, request(viewerRoleId, ScopeType.SECTION, juniors)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already has Manager");
    }

    @Test
    void theDailyInvitationLimitIsEnforced() {
        when(grantRepository.countInvitationsSince(eq(clubId), any(Instant.class))).thenReturn(20L);

        assertThatThrownBy(() -> service.add(caller, clubId, request(viewerRoleId, ScopeType.CLUB, null)))
                .isInstanceOf(LinkRateLimitedException.class);
        verify(personService, never()).findOrCreatePerson(any(), any(), any(), any());
    }

    // --------------------------------------------------------------- remove

    @Test
    void aPeerCanBeRemoved() {
        UUID peerId = UUID.randomUUID();
        RoleAssignment peer = grant(peerId, AccessRole.MANAGER_ID, ScopeType.CLUB, clubId);
        when(grantRepository.findById(peer.getId())).thenReturn(Optional.of(peer));

        service.remove(caller, clubId, peer.getId());

        verify(grantRepository).delete(peer);
    }

    @Test
    void youCannotRemoveYourOwnAccess() {
        RoleAssignment own = grant(callerId, AccessRole.MANAGER_ID, ScopeType.CLUB, clubId);
        when(grantRepository.findById(own.getId())).thenReturn(Optional.of(own));

        assertThatThrownBy(() -> service.remove(caller, clubId, own.getId())).isInstanceOf(AccessDeniedException.class);
        verify(grantRepository, never()).delete(any(RoleAssignment.class));
    }

    @Test
    void theLastClubWideManagerCannotBeRemoved() {
        RoleAssignment last = grant(UUID.randomUUID(), AccessRole.MANAGER_ID, ScopeType.CLUB, clubId);
        when(grantRepository.findById(last.getId())).thenReturn(Optional.of(last));
        when(grantRepository.countClubWideManagers(clubId, AccessRole.MANAGER_ID)).thenReturn(1L);

        assertThatThrownBy(() -> service.remove(caller, clubId, last.getId())).isInstanceOf(ConflictException.class);
        verify(grantRepository, never()).delete(any(RoleAssignment.class));
    }

    @Test
    void aSectionManagerCannotRemoveAClubWideGrant() {
        callerIsSectionManagerOf(juniors);
        RoleAssignment clubWide = grant(UUID.randomUUID(), viewerRoleId, ScopeType.CLUB, clubId);
        when(grantRepository.findById(clubWide.getId())).thenReturn(Optional.of(clubWide));

        assertThatThrownBy(() -> service.remove(caller, clubId, clubWide.getId())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aSectionManagerCannotRemoveAGrantBiggerThanWhatTheyHold() {
        callerIsSectionManagerOf(juniors);
        RoleAssignment bigger = grant(UUID.randomUUID(), AccessRole.MANAGER_ID, ScopeType.SECTION, juniors);
        when(grantRepository.findById(bigger.getId())).thenReturn(Optional.of(bigger));

        assertThatThrownBy(() -> service.remove(caller, clubId, bigger.getId())).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aGrantOfAnotherClubIsNotFound() {
        RoleAssignment foreign = grant(UUID.randomUUID(), AccessRole.MANAGER_ID, ScopeType.CLUB, otherClubId);
        when(grantRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.remove(caller, clubId, foreign.getId())).isInstanceOf(NotFoundException.class);
    }

    // ----------------------------------------------------------- change role

    @Test
    void aPeerCanBeChangedToASmallerRole() {
        RoleAssignment peer = grant(UUID.randomUUID(), AccessRole.MANAGER_ID, ScopeType.SECTION, juniors);
        when(grantRepository.findById(peer.getId())).thenReturn(Optional.of(peer));

        service.changeRole(caller, clubId, peer.getId(), new ChangeAccessGrantRoleRequest(viewerRoleId));

        assertThat(peer.getAccessRoleId()).isEqualTo(viewerRoleId);
        verify(grantRepository).save(peer);
    }

    @Test
    void theLastClubWideManagerCannotBeChangedToASmallerRole() {
        RoleAssignment last = grant(UUID.randomUUID(), AccessRole.MANAGER_ID, ScopeType.CLUB, clubId);
        when(grantRepository.findById(last.getId())).thenReturn(Optional.of(last));
        when(grantRepository.countClubWideManagers(clubId, AccessRole.MANAGER_ID)).thenReturn(1L);

        assertThatThrownBy(() -> service.changeRole(caller, clubId, last.getId(), new ChangeAccessGrantRoleRequest(viewerRoleId)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void youCannotChangeYourOwnRole() {
        RoleAssignment own = grant(callerId, AccessRole.MANAGER_ID, ScopeType.CLUB, clubId);
        when(grantRepository.findById(own.getId())).thenReturn(Optional.of(own));

        assertThatThrownBy(() -> service.changeRole(caller, clubId, own.getId(), new ChangeAccessGrantRoleRequest(viewerRoleId)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aSectionManagerCannotRaiseSomeoneToARoleTheyDoNotHold() {
        callerIsSectionManagerOf(juniors);
        RoleAssignment peer = grant(UUID.randomUUID(), viewerRoleId, ScopeType.SECTION, juniors);
        when(grantRepository.findById(peer.getId())).thenReturn(Optional.of(peer));

        assertThatThrownBy(() -> service.changeRole(caller, clubId, peer.getId(), new ChangeAccessGrantRoleRequest(AccessRole.MANAGER_ID)))
                .isInstanceOf(AccessDeniedException.class);
        verify(grantRepository, never()).save(any(RoleAssignment.class));
    }

    // --------------------------------------------------------------- resend

    @Test
    void resendingAnInvitationToSomeoneWhoHasSignedInIsRefused() {
        UUID samId = UUID.randomUUID();
        RoleAssignment peer = grant(samId, viewerRoleId, ScopeType.CLUB, clubId);
        when(grantRepository.findById(peer.getId())).thenReturn(Optional.of(peer));
        when(personRepository.findAllById(any())).thenReturn(List.of(person(samId, PersonStatus.ACTIVE, true)));

        assertThatThrownBy(() -> service.resend(caller, clubId, peer.getId())).isInstanceOf(ConflictException.class);
        verify(keycloak, never()).resendInvitation(any());
    }

    @Test
    void resendingToAnInvitedPersonSendsAndStampsTheGrant() {
        UUID samId = UUID.randomUUID();
        Person sam = person(samId, PersonStatus.PENDING, true);
        RoleAssignment peer = grant(samId, viewerRoleId, ScopeType.CLUB, clubId);
        when(grantRepository.findById(peer.getId())).thenReturn(Optional.of(peer));
        when(personRepository.findAllById(any())).thenReturn(List.of(sam));

        service.resend(caller, clubId, peer.getId());

        verify(keycloak).resendInvitation(sam);
        assertThat(peer.getInvitationSentAt()).isNotNull();
    }

    // ----------------------------------------------------------------- list

    @Test
    void aSectionViewerSeesTheirSectionAndOwnGrantAndOnlyACountOfClubWideHolders() {
        heldClubWide = EnumSet.noneOf(Permission.class);
        heldSections = Set.of(juniors);
        heldInSections = EnumSet.of(Permission.ACCESS_VIEW, Permission.ACCESS_MANAGE, Permission.PLAYERS_VIEW, Permission.MATCHES_VIEW);
        when(accessService.sectionIdsFor(caller, clubId, Permission.ACCESS_VIEW)).thenReturn(Optional.of(Set.of(juniors)));
        when(accessService.sectionIdsFor(caller, clubId, Permission.ACCESS_MANAGE)).thenReturn(Optional.of(Set.of(juniors)));
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        when(grantRepository.findByScopeTypeAndScopeId(ScopeType.CLUB, clubId))
                .thenReturn(List.of(grant(a, AccessRole.MANAGER_ID, ScopeType.CLUB, clubId)));
        when(grantRepository.findByScopeTypeAndScopeIdIn(eq(ScopeType.SECTION), any()))
                .thenReturn(List.of(
                        grant(b, viewerRoleId, ScopeType.SECTION, juniors),
                        grant(c, viewerRoleId, ScopeType.SECTION, seniors)));
        when(personRepository.findAllById(any())).thenReturn(List.of(person(b, PersonStatus.ACTIVE, true)));

        AccessGrantListDto list = service.list(caller, clubId);

        assertThat(list.items()).hasSize(1);
        assertThat(list.items().get(0).sectionId()).isEqualTo(juniors);
        assertThat(list.clubWideCount()).isEqualTo(1);
        assertThat(list.canGrantClubWide()).isFalse();
        assertThat(list.grantableSectionIds()).containsExactly(juniors);
    }

    @Test
    void aClubWideManagerSeesEveryGrantAndMayGrantClubWide() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        when(grantRepository.findByScopeTypeAndScopeId(ScopeType.CLUB, clubId))
                .thenReturn(List.of(grant(a, AccessRole.MANAGER_ID, ScopeType.CLUB, clubId)));
        when(grantRepository.findByScopeTypeAndScopeIdIn(eq(ScopeType.SECTION), any()))
                .thenReturn(List.of(grant(b, viewerRoleId, ScopeType.SECTION, seniors)));
        when(personRepository.findAllById(any()))
                .thenReturn(List.of(person(a, PersonStatus.ACTIVE, true), person(b, PersonStatus.PENDING, false)));

        AccessGrantListDto list = service.list(caller, clubId);

        assertThat(list.items()).hasSize(2);
        assertThat(list.clubWideCount()).isZero();
        assertThat(list.canManage()).isTrue();
        assertThat(list.canGrantClubWide()).isTrue();
        assertThat(list.items()).anySatisfy(item -> assertThat(item.status()).isEqualTo("INVITED"));
        assertThat(list.roles()).hasSize(2);
        assertThat(list.roles()).allSatisfy(role -> assertThat(role.clubWide()).isTrue());
    }
}
