package com.cricketlegend.repository;

import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleAssignmentRepository extends JpaRepository<RoleAssignment, UUID> {

    /** The lookup {@link com.cricketlegend.config.AccessService#canAdministerClub} relies on. */
    boolean existsByPersonIdAndRoleAndScopeTypeAndScopeId(
            UUID personId, RoleAssignmentRole role, ScopeType scopeType, UUID scopeId);

    /** Every grant a Person holds — reusable by a future `/me/access` endpoint (see Non-goals). */
    List<RoleAssignment> findByPersonId(UUID personId);

    /**
     * Every {@code SECTION}-scope grant a Person holds for a given role — the lookup {@link
     * com.cricketlegend.config.AccessService#accessibleSectionIds} uses to resolve the closed set
     * of sections a section-scoped {@code CLUB_ADMIN} can administer. See
     * docs/specs/035-section-scoped-access.md.
     */
    List<RoleAssignment> findByPersonIdAndRoleAndScopeType(
            UUID personId, RoleAssignmentRole role, ScopeType scopeType);
}
