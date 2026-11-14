package com.cricketlegend.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A named bundle of {@link Permission}s, per docs/specs/150-managers-and-access-grants.md. {@code clubId} is null for
 * the built-in, global roles; a later spec adds club-owned custom roles on the same table. Read-only here: no code
 * creates or edits a role in this release, the five built-in roles come from migration 064.
 */
@Entity
@Table(name = "access_role")
@Getter
@NoArgsConstructor
public class AccessRole {

    /** The built-in Manager role, seeded with this fixed id by migration 064; every legacy CLUB_ADMIN grant carries it. */
    public static final UUID MANAGER_ID = UUID.fromString("00000000-0000-4000-a000-000000000001");

    @Id
    private UUID id;

    @Column(name = "club_id")
    private UUID clubId;

    @Column(nullable = false)
    private String key;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(name = "built_in", nullable = false)
    private boolean builtIn;

    // Stored as the enum name; a value this code does not know (a permission removed in a later release) is ignored on
    // read, see permissions().
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "access_role_permission", joinColumns = @JoinColumn(name = "role_id"))
    @Column(name = "permission", nullable = false)
    private Set<String> permissionNames = new HashSet<>();

    /** The permissions this role carries, each with the View permission it implies. Unknown stored names are skipped. */
    public Set<Permission> permissions() {
        Set<Permission> result = EnumSet.noneOf(Permission.class);
        for (String name : permissionNames) {
            try {
                result.addAll(Permission.valueOf(name).withImplied());
            } catch (IllegalArgumentException unknown) {
                // ignored on purpose, see the field comment
            }
        }
        return result;
    }
}
