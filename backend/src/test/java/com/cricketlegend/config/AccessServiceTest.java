package com.cricketlegend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Direct coverage of {@link AccessService}'s own logic — the only place the codebase's {@code
 * @PreAuthorize("@access...(...)")} SpEL wiring's actual behaviour lives. A {@code
 * *ControllerIntegrationTest}'s 403/404 cases can't distinguish this method-security layer from
 * the flat URL-matcher gate that already rejects some callers before the controller is reached —
 * these tests exercise the methods themselves, independent of that URL gate. Per
 * docs/specs/035-section-scoped-access.md's own Test Plan row for {@code AccessService}.
 */
@ExtendWith(MockitoExtension.class)
class AccessServiceTest {

    @Mock
    private PersonRepository personRepository;

    @Mock
    private RoleAssignmentRepository roleAssignmentRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private TeamRepository teamRepository;

    private AccessService accessService;
    private final UUID clubId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        accessService = new AccessService(personRepository, roleAssignmentRepository, sectionRepository, teamRepository);
    }

    // --- canAdministerClub (pre-existing behaviour, unchanged) ---

    @Test
    void returnsFalseForNullAuthentication() {
        assertThat(accessService.canAdministerClub(null, clubId)).isFalse();
    }

    @Test
    void returnsFalseWhenAuthorityIsNotPlatformAdmin() {
        var authentication = new TestingAuthenticationToken(
                "someone-else", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));
        when(personRepository.findByKeycloakUserId("someone-else")).thenReturn(Optional.empty());

        assertThat(accessService.canAdministerClub(authentication, clubId)).isFalse();
    }

    @Test
    void returnsTrueWhenAuthorityIsPlatformAdmin() {
        var authentication = new TestingAuthenticationToken(
                "platform-admin", null, List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));

        assertThat(accessService.canAdministerClub(authentication, clubId)).isTrue();
    }

    @Test
    void returnsFalseWhenNoPersonIsFoundForTheCallersKeycloakUserIdRatherThanThrowing() {
        var authentication = new TestingAuthenticationToken(
                "unknown-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));
        when(personRepository.findByKeycloakUserId("unknown-subject")).thenReturn(Optional.empty());

        assertThat(accessService.canAdministerClub(authentication, clubId)).isFalse();
    }

    @Test
    void returnsTrueWhenPersonHoldsAClubAdminRoleAssignmentScopedToTheExactClubId() {
        var authentication = new TestingAuthenticationToken(
                "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));
        Person person = new Person();
        person.setId(UUID.randomUUID());
        when(personRepository.findByKeycloakUserId("club-admin-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(true);

        assertThat(accessService.canAdministerClub(authentication, clubId)).isTrue();
    }

    @Test
    void returnsFalseWhenPersonsClubAdminRoleAssignmentIsScopedToADifferentClubId() {
        var authentication = new TestingAuthenticationToken(
                "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));
        Person person = new Person();
        person.setId(UUID.randomUUID());
        UUID otherClubId = UUID.randomUUID();
        when(personRepository.findByKeycloakUserId("club-admin-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, otherClubId))
                .thenReturn(true);

        assertThat(accessService.canAdministerClub(authentication, otherClubId)).isTrue();
        assertThat(accessService.canAdministerClub(authentication, clubId)).isFalse();
    }

    @Test
    void returnsFalseWhenPersonHoldsOnlyAManagerOrPlayerGrantAndNoClubAdminGrant() {
        var authentication = new TestingAuthenticationToken(
                "manager-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));
        Person person = new Person();
        person.setId(UUID.randomUUID());
        when(personRepository.findByKeycloakUserId("manager-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(false);

        assertThat(accessService.canAdministerClub(authentication, clubId)).isFalse();
    }

    @Test
    void isPlatformAdminReturnsFalseForNullAuthentication() {
        assertThat(accessService.isPlatformAdmin(null)).isFalse();
    }

    @Test
    void isPlatformAdminReturnsFalseWhenTheCallerHasNoPlatformAdminAuthority() {
        var authentication = new TestingAuthenticationToken(
                "someone-else", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

        assertThat(accessService.isPlatformAdmin(authentication)).isFalse();
    }

    @Test
    void isPlatformAdminReturnsTrueWhenTheCallerHasThePlatformAdminAuthority() {
        var authentication = new TestingAuthenticationToken(
                "platform-admin", null, List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));

        assertThat(accessService.isPlatformAdmin(authentication)).isTrue();
    }

    // --- accessibleSectionIds ---

    @Test
    void accessibleSectionIdsIsEmptyOptionalForPlatformAdmin() {
        var authentication = new TestingAuthenticationToken(
                "platform-admin", null, List.of(new SimpleGrantedAuthority("ROLE_platform_admin")));

        assertThat(accessService.accessibleSectionIds(authentication, clubId)).isEmpty();
    }

    @Test
    void accessibleSectionIdsIsEmptyOptionalForAClubScopeGrant() {
        var authentication = clubAdminAuthentication("club-admin-subject");
        Person person = personWithId();
        when(personRepository.findByKeycloakUserId("club-admin-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(true);

        assertThat(accessService.accessibleSectionIds(authentication, clubId)).isEmpty();
    }

    @Test
    void accessibleSectionIdsReturnsARealClosedDescendantSetForASectionScopeGrant() {
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");

        UUID juniors = UUID.randomUUID();
        UUID u13 = UUID.randomUUID();
        UUID u13a = UUID.randomUUID();
        UUID u15 = UUID.randomUUID();
        UUID openSection = UUID.randomUUID(); // sibling, not under juniors — must be excluded

        when(sectionRepository.findByClubId(clubId)).thenReturn(List.of(
                section(juniors, clubId, null),
                section(u13, clubId, juniors),
                section(u13a, clubId, u13),
                section(u15, clubId, juniors),
                section(openSection, clubId, null)));
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of(grant(person.getId(), ScopeType.SECTION, juniors)));

        Optional<Set<UUID>> result = accessService.accessibleSectionIds(authentication, clubId);

        assertThat(result).isPresent();
        assertThat(result.get()).containsExactlyInAnyOrder(juniors, u13, u13a, u15);
        assertThat(result.get()).doesNotContain(openSection);
    }

    @Test
    void accessibleSectionIdsIsTheUnionOfTwoSectionScopeGrants() {
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");

        UUID juniors = UUID.randomUUID();
        UUID vets = UUID.randomUUID();
        UUID open = UUID.randomUUID();

        when(sectionRepository.findByClubId(clubId)).thenReturn(
                List.of(section(juniors, clubId, null), section(vets, clubId, null), section(open, clubId, null)));
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of(
                        grant(person.getId(), ScopeType.SECTION, juniors),
                        grant(person.getId(), ScopeType.SECTION, vets)));

        Optional<Set<UUID>> result = accessService.accessibleSectionIds(authentication, clubId);

        assertThat(result).isPresent();
        assertThat(result.get()).containsExactlyInAnyOrder(juniors, vets);
    }

    @Test
    void accessibleSectionIdsIsAnEmptySetForNoGrantAtAll() {
        var authentication = clubAdminAuthentication("no-grant-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "no-grant-subject");
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of());

        Optional<Set<UUID>> result = accessService.accessibleSectionIds(authentication, clubId);

        assertThat(result).isPresent();
        assertThat(result.get()).isEmpty();
    }

    // --- canAccessClub ---

    @Test
    void canAccessClubIsTrueForAClubWideAdmin() {
        var authentication = clubAdminAuthentication("club-admin-subject");
        Person person = personWithId();
        when(personRepository.findByKeycloakUserId("club-admin-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(true);

        assertThat(accessService.canAccessClub(authentication, clubId)).isTrue();
    }

    @Test
    void canAccessClubIsTrueForASectionScopedAdminHoldingAtLeastOneGrant() {
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");
        UUID juniors = UUID.randomUUID();
        when(sectionRepository.findByClubId(clubId)).thenReturn(List.of(section(juniors, clubId, null)));
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of(grant(person.getId(), ScopeType.SECTION, juniors)));

        assertThat(accessService.canAccessClub(authentication, clubId)).isTrue();
    }

    @Test
    void canAccessClubIsFalseForACallerWithNoGrantAtAll() {
        var authentication = clubAdminAuthentication("no-grant-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "no-grant-subject");
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of());

        assertThat(accessService.canAccessClub(authentication, clubId)).isFalse();
    }

    // --- canAdministerSection / assertCanAdministerSection ---

    @Test
    void canAdministerSectionThrowsNotFoundWhenSectionDoesNotBelongToClub() {
        UUID sectionId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId, null)));
        var authentication = clubAdminAuthentication("someone");

        assertThatThrownBy(() -> accessService.canAdministerSection(authentication, clubId, sectionId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void canAdministerSectionThrowsNotFoundWhenSectionDoesNotExistAtAll() {
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.empty());
        var authentication = clubAdminAuthentication("someone");

        assertThatThrownBy(() -> accessService.canAdministerSection(authentication, clubId, sectionId))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void canAdministerSectionIsTrueForAClubWideAdminOnAnySectionOfTheirClub() {
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, null)));
        var authentication = clubAdminAuthentication("club-admin-subject");
        Person person = personWithId();
        when(personRepository.findByKeycloakUserId("club-admin-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(true);

        assertThat(accessService.canAdministerSection(authentication, clubId, sectionId)).isTrue();
    }

    @Test
    void canAdministerSectionIsTrueWhenSectionIsWithinTheCallersOwnAccessibleClosure() {
        UUID juniors = UUID.randomUUID();
        UUID u13 = UUID.randomUUID();
        when(sectionRepository.findById(u13)).thenReturn(Optional.of(section(u13, clubId, juniors)));
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");
        when(sectionRepository.findByClubId(clubId))
                .thenReturn(List.of(section(juniors, clubId, null), section(u13, clubId, juniors)));
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of(grant(person.getId(), ScopeType.SECTION, juniors)));

        assertThat(accessService.canAdministerSection(authentication, clubId, u13)).isTrue();
    }

    @Test
    void canAdministerSectionIsFalseWhenSectionIsOutsideTheCallersOwnAccessibleClosure() {
        UUID juniors = UUID.randomUUID();
        UUID openSection = UUID.randomUUID();
        when(sectionRepository.findById(openSection)).thenReturn(Optional.of(section(openSection, clubId, null)));
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");
        when(sectionRepository.findByClubId(clubId))
                .thenReturn(List.of(section(juniors, clubId, null), section(openSection, clubId, null)));
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of(grant(person.getId(), ScopeType.SECTION, juniors)));

        assertThat(accessService.canAdministerSection(authentication, clubId, openSection)).isFalse();
    }

    @Test
    void assertCanAdministerSectionThrowsAccessDeniedWhenNotAuthorized() {
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, null)));
        var authentication = clubAdminAuthentication("no-grant-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "no-grant-subject");
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of());

        assertThatThrownBy(() -> accessService.assertCanAdministerSection(authentication, clubId, sectionId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void assertCanAdministerSectionDoesNotThrowWhenAuthorized() {
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId, null)));
        var authentication = clubAdminAuthentication("club-admin-subject");
        Person person = personWithId();
        when(personRepository.findByKeycloakUserId("club-admin-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(true);

        accessService.assertCanAdministerSection(authentication, clubId, sectionId);
    }

    // --- assertCanAdministerAnySection ---

    @Test
    void assertCanAdministerAnySectionPassesForAClubWideAdminRegardlessOfSectionIds() {
        var authentication = clubAdminAuthentication("club-admin-subject");
        Person person = personWithId();
        when(personRepository.findByKeycloakUserId("club-admin-subject")).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(true);

        accessService.assertCanAdministerAnySection(authentication, clubId, List.of());
    }

    @Test
    void assertCanAdministerAnySectionThrowsWhenSectionIdsIsEmptyForANonClubWideCaller() {
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");

        assertThatThrownBy(() -> accessService.assertCanAdministerAnySection(authentication, clubId, List.of()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void assertCanAdministerAnySectionPassesWhenAtLeastOneSectionIsAccessible() {
        UUID juniors = UUID.randomUUID();
        UUID openSection = UUID.randomUUID();
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");
        when(sectionRepository.findByClubId(clubId))
                .thenReturn(List.of(section(juniors, clubId, null), section(openSection, clubId, null)));
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of(grant(person.getId(), ScopeType.SECTION, juniors)));

        accessService.assertCanAdministerAnySection(authentication, clubId, List.of(openSection, juniors));
    }

    @Test
    void assertCanAdministerAnySectionThrowsWhenNoneOfTheSectionsAreAccessible() {
        UUID juniors = UUID.randomUUID();
        UUID openSection = UUID.randomUUID();
        var authentication = clubAdminAuthentication("section-admin-subject");
        Person person = personWithId();
        stubNoClubGrant(person, "section-admin-subject");
        when(sectionRepository.findByClubId(clubId))
                .thenReturn(List.of(section(juniors, clubId, null), section(openSection, clubId, null)));
        when(roleAssignmentRepository.findByPersonIdAndRoleAndScopeType(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.SECTION))
                .thenReturn(List.of(grant(person.getId(), ScopeType.SECTION, juniors)));

        assertThatThrownBy(() -> accessService.assertCanAdministerAnySection(
                        authentication, clubId, List.of(openSection)))
                .isInstanceOf(AccessDeniedException.class);
    }

    // --- sectionAndDescendantIds ---

    @Test
    void sectionAndDescendantIdsReturnsSelfAndEveryDescendantRegardlessOfCaller() {
        UUID juniors = UUID.randomUUID();
        UUID u13 = UUID.randomUUID();
        UUID u13a = UUID.randomUUID();
        UUID openSection = UUID.randomUUID();
        when(sectionRepository.findByClubId(clubId)).thenReturn(List.of(
                section(juniors, clubId, null),
                section(u13, clubId, juniors),
                section(u13a, clubId, u13),
                section(openSection, clubId, null)));

        Set<UUID> result = accessService.sectionAndDescendantIds(clubId, juniors);

        assertThat(result).containsExactlyInAnyOrder(juniors, u13, u13a);
        assertThat(result).doesNotContain(openSection);
    }

    @Test
    void sectionAndDescendantIdsReturnsJustSelfForALeafSection() {
        UUID openSection = UUID.randomUUID();
        when(sectionRepository.findByClubId(clubId)).thenReturn(List.of(section(openSection, clubId, null)));

        assertThat(accessService.sectionAndDescendantIds(clubId, openSection)).containsExactly(openSection);
    }

    // --- resolveMatchSectionIds ---

    @Test
    void resolveMatchSectionIdsResolvesBothSidesWhenBothAreOwnClubTeams() {
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID homeSectionId = UUID.randomUUID();
        UUID awaySectionId = UUID.randomUUID();
        when(teamRepository.findById(homeTeamId))
                .thenReturn(Optional.of(Team.builder().id(homeTeamId).clubId(clubId).sectionId(homeSectionId).build()));
        when(teamRepository.findById(awayTeamId))
                .thenReturn(Optional.of(Team.builder().id(awayTeamId).clubId(clubId).sectionId(awaySectionId).build()));

        assertThat(accessService.resolveMatchSectionIds(clubId, homeTeamId, awayTeamId))
                .containsExactlyInAnyOrder(homeSectionId, awaySectionId);
    }

    @Test
    void resolveMatchSectionIdsExcludesAFreeTextOrOtherClubSide() {
        UUID homeTeamId = UUID.randomUUID();
        UUID homeSectionId = UUID.randomUUID();
        UUID otherClubTeamId = UUID.randomUUID();
        when(teamRepository.findById(homeTeamId))
                .thenReturn(Optional.of(Team.builder().id(homeTeamId).clubId(clubId).sectionId(homeSectionId).build()));
        when(teamRepository.findById(otherClubTeamId)).thenReturn(Optional.of(
                Team.builder().id(otherClubTeamId).clubId(UUID.randomUUID()).sectionId(UUID.randomUUID()).build()));

        assertThat(accessService.resolveMatchSectionIds(clubId, homeTeamId, otherClubTeamId))
                .containsExactly(homeSectionId);
    }

    @Test
    void resolveMatchSectionIdsIsEmptyWhenNeitherSideResolvesToAnOwnClubTeam() {
        assertThat(accessService.resolveMatchSectionIds(clubId, null, null)).isEmpty();
    }

    // --- helpers ---

    private TestingAuthenticationToken clubAdminAuthentication(String subject) {
        return new TestingAuthenticationToken(subject, null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));
    }

    private Person personWithId() {
        Person person = new Person();
        person.setId(UUID.randomUUID());
        return person;
    }

    private void stubNoClubGrant(Person person, String subject) {
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .thenReturn(false);
    }

    private Section section(UUID id, UUID clubId, UUID parentSectionId) {
        return Section.builder().id(id).clubId(clubId).parentSectionId(parentSectionId).name("Section").active(true).build();
    }

    private RoleAssignment grant(UUID personId, ScopeType scopeType, UUID scopeId) {
        return RoleAssignment.builder()
                .personId(personId)
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(scopeType)
                .scopeId(scopeId)
                .build();
    }
}
