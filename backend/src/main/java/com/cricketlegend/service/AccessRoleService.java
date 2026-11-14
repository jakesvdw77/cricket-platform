package com.cricketlegend.service;

import com.cricketlegend.domain.AccessRole;
import com.cricketlegend.dto.AccessRoleDto;
import java.util.List;

/** Reads the roles a grant can carry, per docs/specs/150-managers-and-access-grants.md. */
public interface AccessRoleService {

    /** The built-in roles with their permissions. */
    List<AccessRoleDto> list();

    /** True for a role that may be given today: only roles whose areas are enforced (docs/specs/150 Rollout, Release 2). */
    boolean isAssignable(AccessRole role);
}
