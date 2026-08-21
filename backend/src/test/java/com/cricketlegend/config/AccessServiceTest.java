package com.cricketlegend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Direct coverage of {@link AccessService#canAdministerClub}'s own logic — the only place the
 * codebase's first {@code @PreAuthorize("@access.canAdministerClub(...)")} SpEL wiring's actual
 * behaviour lives. {@code ClubProfileControllerIntegrationTest}'s 403 case can't distinguish this
 * method-security layer from the flat {@code /api/v1/platform/**} URL-matcher gate that already
 * rejects a non-platform_admin caller before the controller is reached — this test exercises the
 * method itself, independent of that URL gate.
 */
@ExtendWith(MockitoExtension.class)
class AccessServiceTest {

    @Mock
    private PersonRepository personRepository;

    @Mock
    private RoleAssignmentRepository roleAssignmentRepository;

    private AccessService accessService;
    private final UUID clubId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        accessService = new AccessService(personRepository, roleAssignmentRepository);
    }

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
        // The everyday case today, per AccessService's own "known, honest limitation" Javadoc:
        // Person.keycloakUserId is unset everywhere in production until the next (Keycloak
        // provisioning) spec, so this Optional.empty() path is what every real, non-platform_admin
        // caller currently hits. Named explicitly (unlike returnsFalseWhenAuthorityIsNotPlatformAdmin's
        // incidental setup) to prove this exact "not found -> false, not a throw" behaviour on its own.
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
        // The person really does hold a CLUB_ADMIN grant — just scoped to otherClubId, not the
        // clubId being checked. Proving the grant is real (not simply absent) is what distinguishes
        // this test from returnsFalseWhenPersonHoldsOnlyAManagerOrPlayerGrantAndNoClubAdminGrant below.
        when(roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, otherClubId))
                .thenReturn(true);

        assertThat(accessService.canAdministerClub(authentication, otherClubId)).isTrue();
        assertThat(accessService.canAdministerClub(authentication, clubId)).isFalse();
    }

    @Test
    void returnsFalseWhenPersonHoldsOnlyAManagerOrPlayerGrantAndNoClubAdminGrant() {
        // MANAGER/PLAYER grants exist for this Person (per RoleAssignment's own multi-role-per-Person
        // shape), but canAdministerClub only ever queries for CLUB_ADMIN — so any non-CLUB_ADMIN-only
        // Person is indistinguishable, from this method's perspective, from holding no CLUB_ADMIN
        // grant at all. Mocking the CLUB_ADMIN-specific lookup to return false is the correct way to
        // represent "holds MANAGER/PLAYER but not CLUB_ADMIN" against this repository's actual API.
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
}
