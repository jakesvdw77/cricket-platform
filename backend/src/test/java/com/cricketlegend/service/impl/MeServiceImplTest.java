package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.dto.MeAccessDto;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Unit tests for MeServiceImpl per docs/specs/016-keycloak-account-provisioning.md's Test Plan
 * ("MeServiceImplTest (new)"). Package placement follows
 * docs/plans/016-keycloak-account-provisioning.md's Flag #5 (com.cricketlegend.service.impl,
 * matching AdminIdentityServiceImplTest's newer convention).
 */
@ExtendWith(MockitoExtension.class)
class MeServiceImplTest {

    @Mock
    private PersonRepository personRepository;

    @Mock
    private RoleAssignmentRepository roleAssignmentRepository;

    @Mock
    private AccessService accessService;

    private MeServiceImpl meService;

    @BeforeEach
    void setUp() {
        meService = new MeServiceImpl(personRepository, roleAssignmentRepository, accessService);
    }

    private Jwt jwtWithEmail(String subject, String email) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "none")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .claim("sub", subject);
        if (email != null) {
            builder.claim("email", email);
        }
        return builder.build();
    }

    private Person person(UUID id, PersonStatus status) {
        Person person = new Person();
        person.setId(id);
        person.setFirstName("Jane");
        person.setLastName("Doe");
        person.setEmail("jane.doe@example.com");
        person.setStatus(status);
        return person;
    }

    @Test
    void aCallerAlreadyResolvableByKeycloakUserIdIsReturnedViaTheFastPathWithNoEmailLookupOrWrite() {
        String subject = "11111111-1111-1111-1111-111111111111";
        Person person = person(UUID.randomUUID(), PersonStatus.ACTIVE);
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, "jane.doe@example.com");
        when(accessService.isPlatformAdmin(authentication)).thenReturn(false);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.findByPersonId(person.getId())).thenReturn(List.of());

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(result.personId()).isEqualTo(person.getId());
        assertThat(result.personStatus()).isEqualTo(PersonStatus.ACTIVE);
        verify(personRepository, never()).findByEmailIgnoreCase(any());
        verify(personRepository, never()).save(any());
    }

    @Test
    void aCallerOnlyResolvableByEmailGetsKeycloakUserIdSetAndPendingFlippedToActive() {
        String subject = "22222222-2222-2222-2222-222222222222";
        String email = "jane.doe@example.com";
        Person pendingPerson = person(UUID.randomUUID(), PersonStatus.PENDING);
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, email);
        when(accessService.isPlatformAdmin(authentication)).thenReturn(false);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.empty());
        when(personRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(pendingPerson));
        when(personRepository.save(pendingPerson)).thenReturn(pendingPerson);
        when(roleAssignmentRepository.findByPersonId(pendingPerson.getId())).thenReturn(List.of());

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(pendingPerson.getKeycloakUserId()).isEqualTo(subject);
        assertThat(pendingPerson.getStatus()).isEqualTo(PersonStatus.ACTIVE);
        assertThat(result.personId()).isEqualTo(pendingPerson.getId());
        assertThat(result.personStatus()).isEqualTo(PersonStatus.ACTIVE);
        verify(personRepository).save(pendingPerson);
    }

    @Test
    void aCallerResolvableByEmailWhoIsAlreadyActiveIsLeftUntouchedNotReset() {
        // MeServiceImpl.bridgeByEmail only flips PENDING -> ACTIVE; an already-ACTIVE Person found
        // by email (e.g. a second-device first login) still has keycloakUserId set and is still
        // saved (the method always sets keycloakUserId and always calls save), but its status is
        // never touched or "reset" — it was already ACTIVE and stays exactly that.
        String subject = "33333333-3333-3333-3333-333333333333";
        String email = "jane.doe@example.com";
        Person activePerson = person(UUID.randomUUID(), PersonStatus.ACTIVE);
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, email);
        when(accessService.isPlatformAdmin(authentication)).thenReturn(false);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.empty());
        when(personRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(activePerson));
        when(personRepository.save(activePerson)).thenReturn(activePerson);
        when(roleAssignmentRepository.findByPersonId(activePerson.getId())).thenReturn(List.of());

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(activePerson.getStatus()).isEqualTo(PersonStatus.ACTIVE);
        assertThat(result.personStatus()).isEqualTo(PersonStatus.ACTIVE);
    }

    @Test
    void noPersonResolvableAtAllReturnsNullPersonIdAndStatusWithoutThrowing() {
        String subject = "44444444-4444-4444-4444-444444444444";
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, "unknown@example.com");
        when(accessService.isPlatformAdmin(authentication)).thenReturn(false);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.empty());
        when(personRepository.findByEmailIgnoreCase("unknown@example.com")).thenReturn(Optional.empty());

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(result.personId()).isNull();
        assertThat(result.personStatus()).isNull();
        assertThat(result.clubAdminClubIds()).isEmpty();
        verify(personRepository, never()).save(any());
        verify(roleAssignmentRepository, never()).findByPersonId(any());
    }

    @Test
    void noEmailClaimOnTheJwtReturnsNullPersonIdWithoutThrowing() {
        String subject = "55555555-5555-5555-5555-555555555555";
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, null);
        when(accessService.isPlatformAdmin(authentication)).thenReturn(false);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.empty());

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(result.personId()).isNull();
        assertThat(result.personStatus()).isNull();
        verify(personRepository, never()).findByEmailIgnoreCase(any());
    }

    @Test
    void clubAdminClubIdsIncludesOnlyClubAdminScopedToClubRowsExcludingManagerAndPlayerGrants() {
        String subject = "66666666-6666-6666-6666-666666666666";
        Person person = person(UUID.randomUUID(), PersonStatus.ACTIVE);
        UUID clubAdminClubId = UUID.randomUUID();
        UUID managerScopeId = UUID.randomUUID();
        UUID playerScopeId = UUID.randomUUID();
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, "jane.doe@example.com");
        when(accessService.isPlatformAdmin(authentication)).thenReturn(false);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.of(person));
        when(roleAssignmentRepository.findByPersonId(person.getId()))
                .thenReturn(List.of(
                        RoleAssignment.builder()
                                .personId(person.getId())
                                .role(RoleAssignmentRole.CLUB_ADMIN)
                                .scopeType(ScopeType.CLUB)
                                .scopeId(clubAdminClubId)
                                .build(),
                        RoleAssignment.builder()
                                .personId(person.getId())
                                .role(RoleAssignmentRole.MANAGER)
                                .scopeType(ScopeType.SECTION)
                                .scopeId(managerScopeId)
                                .build(),
                        RoleAssignment.builder()
                                .personId(person.getId())
                                .role(RoleAssignmentRole.PLAYER)
                                .scopeType(ScopeType.SECTION)
                                .scopeId(playerScopeId)
                                .build()));

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(result.clubAdminClubIds()).containsExactly(clubAdminClubId);
    }

    @Test
    void platformAdminReflectsAccessServiceIsPlatformAdminTrue() {
        String subject = "77777777-7777-7777-7777-777777777777";
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, null);
        when(accessService.isPlatformAdmin(authentication)).thenReturn(true);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.empty());

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(result.platformAdmin()).isTrue();
    }

    @Test
    void platformAdminReflectsAccessServiceIsPlatformAdminFalse() {
        String subject = "88888888-8888-8888-8888-888888888888";
        var authentication = new TestingAuthenticationToken(subject, null, List.of());
        Jwt jwt = jwtWithEmail(subject, null);
        when(accessService.isPlatformAdmin(authentication)).thenReturn(false);
        when(personRepository.findByKeycloakUserId(subject)).thenReturn(Optional.empty());

        MeAccessDto result = meService.activateAndResolveAccess(authentication, jwt);

        assertThat(result.platformAdmin()).isFalse();
    }
}
