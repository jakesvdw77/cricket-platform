package com.cricketlegend.repository;

import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import java.time.Instant;
import java.util.Collection;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    // --- docs/specs/150-managers-and-access-grants.md ---

    /** Every grant at one place: the club itself, or one section. */
    List<RoleAssignment> findByScopeTypeAndScopeId(ScopeType scopeType, UUID scopeId);

    /** Every grant on any of these sections. */
    List<RoleAssignment> findByScopeTypeAndScopeIdIn(ScopeType scopeType, Collection<UUID> scopeIds);

    /**
     * Club-wide Manager grants of one club (the last one may not be removed, rule 6). A legacy CLUB_ADMIN row nothing has
     * backfilled counts as Manager, as {@code AccessService} reads it.
     */
    @Query("SELECT COUNT(r) FROM RoleAssignment r WHERE r.scopeType = com.cricketlegend.domain.ScopeType.CLUB "
            + "AND r.scopeId = :clubId AND (r.accessRoleId = :managerRoleId "
            + "OR (r.accessRoleId IS NULL AND r.role = com.cricketlegend.domain.RoleAssignmentRole.CLUB_ADMIN))")
    long countClubWideManagers(@Param("clubId") UUID clubId, @Param("managerRoleId") UUID managerRoleId);

    /** Invitations sent for this club since {@code since}, over its club-wide grants and the grants on its sections (rule 10). */
    @Query("SELECT COUNT(r) FROM RoleAssignment r WHERE r.invitationSentAt >= :since AND "
            + "((r.scopeType = com.cricketlegend.domain.ScopeType.CLUB AND r.scopeId = :clubId) "
            + "OR (r.scopeType = com.cricketlegend.domain.ScopeType.SECTION AND r.scopeId IN "
            + "(SELECT s.id FROM Section s WHERE s.clubId = :clubId)))")
    long countInvitationsSince(@Param("clubId") UUID clubId, @Param("since") Instant since);
}
