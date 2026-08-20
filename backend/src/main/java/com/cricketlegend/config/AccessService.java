package com.cricketlegend.config;

import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * First use of {@code docs/standards/backend.md}'s documented future {@code @access.canAdminister(...)}
 * convention — see docs/plans/012-club-profile.md's Flag #2. Nothing in {@link
 * com.cricketlegend.domain.Club}'s tenancy model has {@code Section}/{@code Team}/
 * {@code ClubMembership}/{@code RoleAssignment} yet (docs/specs/001-tenancy-identity-model.md,
 * still not built — see docs/roadmap.md's "Blocked on the full tenancy model" section), so
 * {@code clubId} is currently unused: this just re-checks the flat {@code platform_admin}
 * authority everyone who reaches a {@code @PreAuthorize}-guarded method already carries, having
 * passed the {@code /api/v1/platform/**} URL gate first. The call-site shape
 * ({@code @PreAuthorize("@access.canAdministerClub(authentication, #id)")}) already matches what
 * real scoped resolution will look like, so swapping in {@code RoleAssignment} walking later only
 * touches this method's body.
 */
@Component("access")
public class AccessService {

    public boolean canAdministerClub(Authentication authentication, UUID clubId) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_platform_admin"::equals);
    }
}
