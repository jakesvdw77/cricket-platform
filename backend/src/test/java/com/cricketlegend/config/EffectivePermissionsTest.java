package com.cricketlegend.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.config.EffectivePermissions.ResolvedGrant;
import com.cricketlegend.domain.Permission;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** docs/specs/150: the truth table of what a caller holds, with no Spring and no database. */
class EffectivePermissionsTest {

    private static final UUID JUNIORS = UUID.randomUUID();
    private static final UUID JUNIORS_U15 = UUID.randomUUID();
    private static final UUID SENIORS = UUID.randomUUID();

    private static Set<Permission> all() {
        return EnumSet.allOf(Permission.class);
    }

    private static Set<Permission> viewer() {
        return EnumSet.of(Permission.PLAYERS_VIEW, Permission.MATCHES_VIEW, Permission.LEAGUES_EDIT);
    }

    private static EffectivePermissions clubWide(Set<Permission> permissions) {
        return new EffectivePermissions(List.of(new ResolvedGrant(permissions, null)));
    }

    private static EffectivePermissions juniors(Set<Permission> permissions) {
        return new EffectivePermissions(List.of(new ResolvedGrant(permissions, Set.of(JUNIORS, JUNIORS_U15))));
    }

    @Test
    void noGrantsHoldsNothing() {
        assertThat(EffectivePermissions.NONE.isEmpty()).isTrue();
        assertThat(EffectivePermissions.NONE.holds(Permission.PLAYERS_VIEW)).isFalse();
        assertThat(EffectivePermissions.NONE.holds(Permission.PLAYERS_VIEW, JUNIORS)).isFalse();
    }

    @Test
    void aClubWideGrantHoldsItsPermissionsEverywhere() {
        EffectivePermissions effective = clubWide(viewer());

        assertThat(effective.isEmpty()).isFalse();
        assertThat(effective.holds(Permission.PLAYERS_VIEW)).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_VIEW, SENIORS)).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_EDIT)).isFalse();
        assertThat(effective.holds(Permission.PLAYERS_EDIT, SENIORS)).isFalse();
    }

    @Test
    void aSectionGrantHoldsOnlyInItsSectionAndBeneath() {
        EffectivePermissions effective = juniors(viewer());

        assertThat(effective.holds(Permission.PLAYERS_VIEW)).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_VIEW, JUNIORS)).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_VIEW, JUNIORS_U15)).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_VIEW, SENIORS)).isFalse();
    }

    @Test
    void aClubReachPermissionIsInertOnASectionGrant() {
        EffectivePermissions effective = juniors(viewer());

        assertThat(effective.holds(Permission.LEAGUES_EDIT)).isFalse();
        assertThat(effective.holds(Permission.LEAGUES_EDIT, JUNIORS)).isFalse();
        assertThat(effective.holdsClubWide(Permission.LEAGUES_EDIT)).isFalse();
    }

    @Test
    void aClubReachPermissionCountsOnAClubWideGrantWhateverTheSection() {
        EffectivePermissions effective = clubWide(viewer());

        assertThat(effective.holds(Permission.LEAGUES_EDIT)).isTrue();
        assertThat(effective.holds(Permission.LEAGUES_EDIT, SENIORS)).isTrue();
        assertThat(effective.holdsClubWide(Permission.LEAGUES_EDIT)).isTrue();
    }

    @Test
    void grantsAreUnitedAcrossPlaces() {
        EffectivePermissions effective = new EffectivePermissions(List.of(
                new ResolvedGrant(EnumSet.of(Permission.PLAYERS_VIEW), null),
                new ResolvedGrant(EnumSet.of(Permission.PLAYERS_EDIT, Permission.PLAYERS_VIEW), Set.of(JUNIORS))));

        assertThat(effective.holds(Permission.PLAYERS_VIEW, SENIORS)).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_EDIT, JUNIORS)).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_EDIT, SENIORS)).isFalse();
    }

    @Test
    void sectionIdsForIsUnrestrictedForAClubWideGrantAndClosedForASectionGrant() {
        assertThat(clubWide(viewer()).sectionIdsFor(Permission.PLAYERS_VIEW)).isEmpty();
        assertThat(juniors(viewer()).sectionIdsFor(Permission.PLAYERS_VIEW)).contains(Set.of(JUNIORS, JUNIORS_U15));
        assertThat(juniors(viewer()).sectionIdsFor(Permission.PLAYERS_EDIT)).contains(Set.of());
        assertThat(juniors(viewer()).sectionIdsFor(Permission.LEAGUES_EDIT)).contains(Set.of());
    }

    @Test
    void heldListsEveryPermissionHeldSomewhere() {
        assertThat(juniors(viewer()).held()).containsExactlyInAnyOrder(Permission.PLAYERS_VIEW, Permission.MATCHES_VIEW);
        assertThat(clubWide(all()).held()).containsExactlyInAnyOrderElementsOf(all());
    }

    @Test
    void aSectionGrantWithNoSectionsIsAsGoodAsNoGrant() {
        EffectivePermissions effective = new EffectivePermissions(List.of(new ResolvedGrant(viewer(), Set.of())));

        assertThat(effective.isEmpty()).isTrue();
        assertThat(effective.holds(Permission.PLAYERS_VIEW)).isFalse();
    }
}
