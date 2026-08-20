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
}
