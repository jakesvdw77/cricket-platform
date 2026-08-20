package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for RoleAssignmentRepository — per docs/standards/backend.md, every custom
 * repository query ships a Testcontainers-backed integration test. Also proves
 * 011-add-role-assignment.sql applies cleanly on top of 010 (implicit via context boot — this test
 * class only runs at all if the whole migration chain 001-011 applied without error), and the three
 * real DB-level invariants that migration ships: the {@code person_id} FK, {@code
 * ux_role_assignment_grant}'s exact-duplicate-grant unique index (while explicitly allowing
 * different grants for the same Person — the concrete proof of 015's "multiple roles per Person"
 * concern), and {@code chk_role_assignment_scope_id}'s CHECK constraint. Each test runs in its own
 * rolled-back transaction for isolation, since all tests share one Testcontainers Postgres instance
 * for the whole class.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class RoleAssignmentRepositoryTest {

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Autowired
    private PersonRepository personRepository;

    private Person savedPerson(String email) {
        return personRepository.save(Person.builder()
                .firstName("Jane")
                .lastName("Doe")
                .email(email)
                .build());
    }

    private RoleAssignment grant(UUID personId, RoleAssignmentRole role, ScopeType scopeType, UUID scopeId) {
        return RoleAssignment.builder()
                .personId(personId)
                .role(role)
                .scopeType(scopeType)
                .scopeId(scopeId)
                .build();
    }

    @Test
    void personIdForeignKeyIsEnforcedAgainstANonExistentPerson() {
        RoleAssignment orphan = grant(UUID.randomUUID(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, UUID.randomUUID());

        assertThatThrownBy(() -> roleAssignmentRepository.saveAndFlush(orphan))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void uxRoleAssignmentGrantRejectsAnExactDuplicateGrantAtTheDbLevel() {
        Person person = savedPerson("jane.doe@example.com");
        UUID clubId = UUID.randomUUID();
        roleAssignmentRepository.saveAndFlush(
                grant(person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId));

        RoleAssignment duplicate = grant(person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId);

        assertThatThrownBy(() -> roleAssignmentRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void aPersonCanHoldMultipleDifferentRoleAssignmentsSimultaneously() {
        // The concrete, spec-named proof that "one Person can hold several role grants at once"
        // (e.g. PLAYER in one Section and CLUB_ADMIN for the whole Club, per 001's own worked
        // example) is actually solved by RoleAssignment's one-row-per-grant shape, not just
        // documented — ux_role_assignment_grant only blocks an *exact* duplicate, never a second,
        // differently-shaped grant for the same person_id.
        Person person = savedPerson("jane.doe@example.com");
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();

        RoleAssignment clubAdminGrant = roleAssignmentRepository.save(
                grant(person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId));
        RoleAssignment playerGrant = roleAssignmentRepository.save(
                grant(person.getId(), RoleAssignmentRole.PLAYER, ScopeType.SECTION, sectionId));

        assertThat(clubAdminGrant.getId()).isNotNull();
        assertThat(playerGrant.getId()).isNotNull();
        assertThat(roleAssignmentRepository.findByPersonId(person.getId()))
                .extracting(RoleAssignment::getRole)
                .containsExactlyInAnyOrder(RoleAssignmentRole.CLUB_ADMIN, RoleAssignmentRole.PLAYER);
    }

    @Test
    void chkRoleAssignmentScopeIdRejectsANonPlatformRowWithANullScopeId() {
        Person person = savedPerson("jane.doe@example.com");
        RoleAssignment invalid = grant(person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, null);

        assertThatThrownBy(() -> roleAssignmentRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void chkRoleAssignmentScopeIdAllowsAPlatformScopedRowWithANullScopeId() {
        // Confirms the CHECK constraint's PLATFORM exemption actually works, not just that the
        // general (non-PLATFORM) case is rejected above — even though nothing in this codebase
        // creates a PLATFORM-scoped row yet (per 015's own Non-goals).
        Person person = savedPerson("jane.doe@example.com");
        RoleAssignment platformGrant = grant(person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.PLATFORM, null);

        RoleAssignment saved = roleAssignmentRepository.saveAndFlush(platformGrant);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getScopeId()).isNull();
    }
}
