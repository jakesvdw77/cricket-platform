package com.cricketlegend.dto;

import com.cricketlegend.domain.PersonStatus;
import java.util.List;
import java.util.UUID;

/** Per docs/specs/016-keycloak-account-provisioning.md. */
public record MeAccessDto(
        UUID personId, // null if this login resolves to no Person at all (e.g. a
                        // platform_admin with no Person row — normal, not an error)
        PersonStatus personStatus, // null iff personId is null
        boolean platformAdmin,
        List<UUID> clubAdminClubIds) {}
