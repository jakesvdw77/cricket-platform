package com.cricketlegend.config;

import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * Per docs/specs/015-person-status-and-role-assignment.md: the flat {@code platform_admin} check
 * this method has carried since docs/specs/012-club-profile.md stays exactly as-is — it's the
 * vendor/system-operator persona, still checked directly against a Keycloak realm role, still a
 * superset/override of everything else this method checks. What's new is the second branch: a real
 * {@code RoleAssignment} lookup, resolving the caller's {@link com.cricketlegend.domain.Person} by
 * the JWT's {@code sub} claim (via {@code Authentication.getName()}, the same JWT-subject-as-name
 * precedent docs/specs/013-centralized-logging.md's {@code RequestCorrelationFilter} already
 * relies on) and checking for a {@code CLUB_ADMIN} grant scoped to this {@code clubId}.
 *
 * <p>As of docs/specs/016-keycloak-account-provisioning.md, the {@code RoleAssignment} branch
 * below is genuinely reachable in production: {@code SubscriptionServiceImpl.create()} now
 * provisions a real Keycloak account and grants a {@code CLUB_ADMIN} {@code RoleAssignment} for a
 * Subscription's responsible {@link com.cricketlegend.domain.Person}, and {@code MeServiceImpl}
 * sets {@link com.cricketlegend.domain.Person#getKeycloakUserId()} on that person's first login —
 * closing the gap this class's Javadoc previously flagged as "correct but effectively unreachable."
 */
@Component("access")
public class AccessService {

    private final PersonRepository personRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;

    public AccessService(
            PersonRepository personRepository, RoleAssignmentRepository roleAssignmentRepository) {
        this.personRepository = personRepository;
        this.roleAssignmentRepository = roleAssignmentRepository;
    }

    public boolean isPlatformAdmin(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_platform_admin"::equals);
    }

    public boolean canAdministerClub(Authentication authentication, UUID clubId) {
        if (authentication == null) {
            return false;
        }
        if (isPlatformAdmin(authentication)) {
            return true; // superset/override — platform_admin is untouched by this spec
        }
        return personRepository
                .findByKeycloakUserId(authentication.getName())
                .map(person -> roleAssignmentRepository.existsByPersonIdAndRoleAndScopeTypeAndScopeId(
                        person.getId(), RoleAssignmentRole.CLUB_ADMIN, ScopeType.CLUB, clubId))
                .orElse(false);
    }
}
