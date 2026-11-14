package com.cricketlegend.config;

import com.cricketlegend.domain.Permission;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * What one caller may do inside one club, per docs/specs/150-managers-and-access-grants.md: the union of every grant
 * they hold there, each already resolved to the permissions of its role and (for a section grant) the closed set of
 * sections it covers. Pure logic with no Spring and no repository, so the whole truth table is unit-testable.
 *
 * <p>A {@link Permission.Reach#CLUB} permission counts only through a club-wide grant: on a section grant it is inert,
 * because the data it guards has no section (docs/specs/035). A permission always arrives with the View permission it
 * implies, see {@link com.cricketlegend.domain.AccessRole#permissions()}. Platform admin is decided by the caller of this
 * class, never here.
 */
public final class EffectivePermissions {

    /** {@code sectionIds == null} means club-wide; otherwise the closed set (section plus descendants) the grant covers. */
    public record ResolvedGrant(Set<Permission> permissions, Set<UUID> sectionIds) {
        boolean clubWide() {
            return sectionIds == null;
        }
    }

    public static final EffectivePermissions NONE = new EffectivePermissions(List.of());

    private final List<ResolvedGrant> grants;

    public EffectivePermissions(List<ResolvedGrant> grants) {
        this.grants = List.copyOf(grants);
    }

    /** True when the caller holds no grant at this club at all. */
    public boolean isEmpty() {
        return grants.stream().noneMatch(g -> g.clubWide() || !g.sectionIds().isEmpty());
    }

    /**
     * Does the caller hold {@code permission} anywhere in this club: a club-wide grant carrying it, or (for a section
     * reach permission) any section grant carrying it.
     */
    public boolean holds(Permission permission) {
        for (ResolvedGrant grant : grants) {
            if (!grant.permissions().contains(permission)) {
                continue;
            }
            if (grant.clubWide() || (permission.reach() == Permission.Reach.SECTION && !grant.sectionIds().isEmpty())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Does the caller hold {@code permission} for data in {@code sectionId}. A club reach permission has no section, so
     * the section is ignored and only a club-wide grant counts.
     */
    public boolean holds(Permission permission, UUID sectionId) {
        if (permission.reach() == Permission.Reach.CLUB) {
            return grants.stream().anyMatch(g -> g.clubWide() && g.permissions().contains(permission));
        }
        for (ResolvedGrant grant : grants) {
            if (grant.permissions().contains(permission) && (grant.clubWide() || grant.sectionIds().contains(sectionId))) {
                return true;
            }
        }
        return false;
    }

    /** Does a club-wide grant carry {@code permission}. Used when a club-wide grant is being made (docs/specs/150 rule 2). */
    public boolean holdsClubWide(Permission permission) {
        return grants.stream().anyMatch(g -> g.clubWide() && g.permissions().contains(permission));
    }

    /**
     * The sections {@code permission} applies to, for narrowing a list. {@code Optional.empty()} is the unrestricted
     * sentinel (a club-wide grant carries it), the same convention as {@link AccessService#accessibleSectionIds}; a
     * present set is closed and may be empty. A club reach permission is never held through a section, so it yields an
     * empty set unless a club-wide grant carries it.
     */
    public Optional<Set<UUID>> sectionIdsFor(Permission permission) {
        Set<UUID> sections = new HashSet<>();
        for (ResolvedGrant grant : grants) {
            if (!grant.permissions().contains(permission)) {
                continue;
            }
            if (grant.clubWide()) {
                return Optional.empty();
            }
            if (permission.reach() == Permission.Reach.SECTION) {
                sections.addAll(grant.sectionIds());
            }
        }
        return Optional.of(sections);
    }

    /** True when any club-wide grant exists (the caller has club-wide reach for at least some permission). */
    public boolean hasClubWideGrant() {
        return grants.stream().anyMatch(ResolvedGrant::clubWide);
    }

    /** Every permission the caller holds somewhere in this club. */
    public Set<Permission> held() {
        Set<Permission> result = EnumSet.noneOf(Permission.class);
        for (Permission permission : Permission.values()) {
            if (holds(permission)) {
                result.add(permission);
            }
        }
        return result;
    }
}
