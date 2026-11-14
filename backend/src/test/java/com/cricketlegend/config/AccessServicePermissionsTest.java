package com.cricketlegend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AccessRole;
import com.cricketlegend.domain.Permission;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.AccessRoleRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

/** docs/specs/150: the permission checks of {@link AccessService}, resolved from grants and roles. */
class AccessServicePermissionsTest {

    private final PersonRepository personRepository = mock(PersonRepository.class);
    private final RoleAssignmentRepository roleAssignmentRepository = mock(RoleAssignmentRepository.class);
    private final SectionRepository sectionRepository = mock(SectionRepository.class);
    private final AccessRoleRepository accessRoleRepository = mock(AccessRoleRepository.class);

    private final UUID clubId = UUID.randomUUID();
    private final UUID otherClubId = UUID.randomUUID();
    private final UUID juniors = UUID.randomUUID();
    private final UUID under15 = UUID.randomUUID();
    private final UUID seniors = UUID.randomUUID();
    private final UUID personId = UUID.randomUUID();
    private final UUID viewerRoleId = UUID.randomUUID();
    private final UUID scorerRoleId = UUID.randomUUID();

    private AccessService access;
    private final TestingAuthenticationToken caller = new TestingAuthenticationToken("kc-caller", null);

    @BeforeEach
    void setUp() {
        access = new AccessService(
                personRepository, roleAssignmentRepository, sectionRepository, mock(TeamRepository.class),
                accessRoleRepository, null);
        Person person = new Person();
        person.setId(personId);
        when(personRepository.findByKeycloakUserId("kc-caller")).thenReturn(Optional.of(person));
        when(sectionRepository.findByClubId(clubId))
                .thenReturn(List.of(section(juniors, clubId, null), section(under15, clubId, juniors), section(seniors, clubId, null)));
        when(accessRoleRepository.findAllById(org.mockito.ArgumentMatchers.<Iterable<UUID>>any()))
                .thenAnswer(invocation -> {
                    Set<UUID> wanted = new HashSet<>();
                    ((Iterable<UUID>) invocation.getArgument(0)).forEach(wanted::add);
                    return Stream.of(
                                    role(AccessRole.MANAGER_ID, Stream.of(Permission.values()).map(Enum::name).toArray(String[]::new)),
                                    role(viewerRoleId, "PLAYERS_VIEW", "MATCHES_VIEW", "LEAGUES_EDIT"),
                                    role(scorerRoleId, "RESULTS_EDIT", "MATCHES_VIEW"))
                            .filter(role -> wanted.contains(role.getId()))
                            .collect(Collectors.toList());
                });
    }

    private static Section section(UUID id, UUID club, UUID parent) {
        Section section = new Section();
        section.setId(id);
        section.setClubId(club);
        section.setParentSectionId(parent);
        return section;
    }

    private static AccessRole role(UUID id, String... permissions) {
        AccessRole role = new AccessRole();
        ReflectionTestUtils.setField(role, "id", id);
        ReflectionTestUtils.setField(role, "permissionNames", new HashSet<>(Set.of(permissions)));
        return role;
    }

    private void grants(RoleAssignment... grants) {
        when(roleAssignmentRepository.findByPersonId(personId)).thenReturn(List.of(grants));
    }

    private RoleAssignment grant(UUID roleId, ScopeType scope, UUID scopeId) {
        return RoleAssignment.builder().personId(personId).role(RoleAssignmentRole.CLUB_ADMIN).accessRoleId(roleId)
                .scopeType(scope).scopeId(scopeId).build();
    }

    @Test
    void aClubWideViewerReadsEverywhereAndChangesNothing() {
        grants(grant(viewerRoleId, ScopeType.CLUB, clubId));

        assertThat(access.can(caller, clubId, Permission.PLAYERS_VIEW)).isTrue();
        assertThat(access.can(caller, clubId, Permission.PLAYERS_VIEW, seniors)).isTrue();
        assertThat(access.can(caller, clubId, Permission.PLAYERS_EDIT)).isFalse();
        assertThat(access.can(caller, clubId, Permission.PLAYERS_EDIT, seniors)).isFalse();
    }

    @Test
    void aSectionGrantReachesTheSectionAndItsChildrenOnly() {
        grants(grant(viewerRoleId, ScopeType.SECTION, juniors));

        assertThat(access.can(caller, clubId, Permission.PLAYERS_VIEW, juniors)).isTrue();
        assertThat(access.can(caller, clubId, Permission.PLAYERS_VIEW, under15)).isTrue();
        assertThat(access.can(caller, clubId, Permission.PLAYERS_VIEW, seniors)).isFalse();
    }

    @Test
    void clubReachPermissionsAreInertOnASectionGrantButWorkClubWide() {
        grants(grant(viewerRoleId, ScopeType.SECTION, juniors));
        assertThat(access.can(caller, clubId, Permission.LEAGUES_EDIT)).isFalse();
        assertThat(access.canClubWide(caller, clubId, Permission.LEAGUES_EDIT)).isFalse();

        grants(grant(viewerRoleId, ScopeType.CLUB, clubId));
        assertThat(access.can(caller, clubId, Permission.LEAGUES_EDIT)).isTrue();
        assertThat(access.canClubWide(caller, clubId, Permission.LEAGUES_EDIT)).isTrue();
    }

    @Test
    void aGrantInAnotherClubNeverCounts() {
        grants(grant(AccessRole.MANAGER_ID, ScopeType.CLUB, otherClubId));

        assertThat(access.can(caller, clubId, Permission.PLAYERS_VIEW)).isFalse();
        assertThat(access.hasAnyGrant(caller, clubId)).isFalse();
    }

    @Test
    void aLegacyClubAdminRowWithoutARoleIsTheManagerRole() {
        grants(RoleAssignment.builder().personId(personId).role(RoleAssignmentRole.CLUB_ADMIN).scopeType(ScopeType.CLUB)
                .scopeId(clubId).build());

        assertThat(access.can(caller, clubId, Permission.ACCESS_MANAGE)).isTrue();
        assertThat(access.can(caller, clubId, Permission.CLUB_SETUP_EDIT)).isTrue();
    }

    @Test
    void hasAnyGrantIsTrueForAnyRoleAtAnyPlaceInTheClub() {
        grants(grant(scorerRoleId, ScopeType.SECTION, seniors));
        assertThat(access.hasAnyGrant(caller, clubId)).isTrue();

        grants();
        assertThat(access.hasAnyGrant(caller, clubId)).isFalse();
    }

    @Test
    void aPlatformAdminHoldsEverythingWithNoGrant() {
        TestingAuthenticationToken admin = new TestingAuthenticationToken(
                "kc-admin", null, List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));

        assertThat(access.can(admin, clubId, Permission.ACCESS_MANAGE)).isTrue();
        assertThat(access.hasAnyGrant(admin, clubId)).isTrue();
        assertThat(access.sectionIdsFor(admin, clubId, Permission.PLAYERS_EDIT)).isEmpty();
        access.assertCanAnySection(admin, clubId, Permission.PLAYERS_EDIT, Set.of());
    }

    @Test
    void sectionIdsForNarrowsAListPerPermission() {
        grants(grant(scorerRoleId, ScopeType.SECTION, juniors), grant(viewerRoleId, ScopeType.SECTION, seniors));

        assertThat(access.sectionIdsFor(caller, clubId, Permission.RESULTS_EDIT)).contains(Set.of(juniors, under15));
        assertThat(access.sectionIdsFor(caller, clubId, Permission.MATCHES_VIEW)).contains(Set.of(juniors, under15, seniors));
        assertThat(access.sectionIdsFor(caller, clubId, Permission.PLAYERS_EDIT)).contains(Set.of());

        grants(grant(AccessRole.MANAGER_ID, ScopeType.CLUB, clubId));
        assertThat(access.sectionIdsFor(caller, clubId, Permission.PLAYERS_EDIT)).isEmpty();
    }

    @Test
    void canInSectionAnswersNotFoundForAnotherClubsSectionBeforeAnyPermissionQuestion() {
        UUID foreign = UUID.randomUUID();
        when(sectionRepository.findById(foreign)).thenReturn(Optional.of(section(foreign, otherClubId, null)));
        when(sectionRepository.findById(juniors)).thenReturn(Optional.of(section(juniors, clubId, null)));
        grants(grant(AccessRole.MANAGER_ID, ScopeType.CLUB, clubId));

        assertThatThrownBy(() -> access.canInSection(caller, clubId, Permission.PLAYERS_VIEW, foreign))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> access.canInSection(caller, clubId, Permission.PLAYERS_VIEW, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
        assertThat(access.canInSection(caller, clubId, Permission.PLAYERS_VIEW, juniors)).isTrue();
    }

    @Test
    void assertCanThrowsAccessDeniedOutsideTheCallersPlace() {
        when(sectionRepository.findById(seniors)).thenReturn(Optional.of(section(seniors, clubId, null)));
        grants(grant(viewerRoleId, ScopeType.SECTION, juniors));

        assertThatThrownBy(() -> access.assertCan(caller, clubId, Permission.PLAYERS_VIEW, seniors))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void assertCanAnySectionPassesWhenAnyListedSectionIsHeldAndFailsWhenNoneIs() {
        grants(grant(scorerRoleId, ScopeType.SECTION, juniors));

        access.assertCanAnySection(caller, clubId, Permission.RESULTS_EDIT, Set.of(seniors, under15));
        assertThatThrownBy(() -> access.assertCanAnySection(caller, clubId, Permission.RESULTS_EDIT, Set.of(seniors)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> access.assertCanAnySection(caller, clubId, Permission.PLAYERS_EDIT, Set.of(juniors)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aResourceWithNoSectionIsReachedOnlyByAClubWideHolder() {
        grants(grant(scorerRoleId, ScopeType.SECTION, juniors));
        assertThatThrownBy(() -> access.assertCanAnySection(caller, clubId, Permission.RESULTS_EDIT, Set.of()))
                .isInstanceOf(AccessDeniedException.class);

        grants(grant(scorerRoleId, ScopeType.CLUB, clubId));
        access.assertCanAnySection(caller, clubId, Permission.RESULTS_EDIT, Set.of());
    }

    @Test
    void aCallerWithNoPersonRowHoldsNothing() {
        when(personRepository.findByKeycloakUserId("kc-caller")).thenReturn(Optional.empty());

        assertThat(access.can(caller, clubId, Permission.PLAYERS_VIEW)).isFalse();
        assertThat(access.hasAnyGrant(caller, clubId)).isFalse();
    }
}
