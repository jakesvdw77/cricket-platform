package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.NameAlias;
import com.cricketlegend.domain.NameAliasKind;
import com.cricketlegend.repository.NameAliasRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * docs/specs/104, "Aliases": the normal form, reading the club's active aliases, and {@code remember}: a new pair is
 * written, a repeat changes nothing, a different target replaces the active alias (the old row is deactivated, not
 * deleted), and a platform admin with no person writes one with a null creator.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NameAliasesTest {

    @Mock
    private NameAliasRepository repository;

    private NameAliases aliases;
    private final UUID club = UUID.randomUUID();
    private final UUID player = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final UUID person = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        aliases = new NameAliases(repository);
        when(repository.findByClubIdAndKindAndAliasNormalisedAndActiveTrue(any(), any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void theNormalFormIgnoresCaseAccentsDotsAndHyphensButKeepsWordOrder() {
        assertThat(NameAliases.normalise("  Ábel   NAZAR ")).isEqualTo("abel nazar");
        assertThat(NameAliases.normalise("A. Nazar")).isEqualTo("a nazar");
        assertThat(NameAliases.normalise("Nazar A")).isEqualTo("nazar a");
        assertThat(NameAliases.normalise("Mary-Anne Cole")).isEqualTo("maryanne cole");
        assertThat(NameAliases.normalise(null)).isEmpty();
        assertThat(NameAliases.normalise("   ")).isEmpty();
    }

    @Test
    void theNormalFormIsCappedAt255Characters() {
        assertThat(NameAliases.normalise("x".repeat(400))).hasSize(255);
    }

    @Test
    void aNewAliasIsWrittenForTheClubWithTheOriginalSpelling() {
        aliases.remember(club, NameAliasKind.PLAYER, "  Nazar   A ", player, person);

        ArgumentCaptor<NameAlias> saved = ArgumentCaptor.forClass(NameAlias.class);
        verify(repository).save(saved.capture());
        NameAlias alias = saved.getValue();
        assertThat(alias.getClubId()).isEqualTo(club);
        assertThat(alias.getKind()).isEqualTo(NameAliasKind.PLAYER);
        assertThat(alias.getAliasNormalised()).isEqualTo("nazar a");
        assertThat(alias.getAliasOriginal()).isEqualTo("Nazar A");
        assertThat(alias.getTargetPlayerProfileId()).isEqualTo(player);
        assertThat(alias.getTargetTeamId()).isNull();
        assertThat(alias.getCreatedBy()).isEqualTo(person);
        assertThat(alias.isActive()).isTrue();
    }

    @Test
    void aTeamAliasPointsAtTheTeam() {
        aliases.remember(club, NameAliasKind.TEAM, "Hillside CC", player, person);

        ArgumentCaptor<NameAlias> saved = ArgumentCaptor.forClass(NameAlias.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getTargetTeamId()).isEqualTo(player);
        assertThat(saved.getValue().getTargetPlayerProfileId()).isNull();
    }

    @Test
    void repeatingTheSamePairWritesNothing() {
        NameAlias current = NameAlias.builder().clubId(club).kind(NameAliasKind.PLAYER).aliasNormalised("nazar a")
                .targetPlayerProfileId(player).active(true).build();
        when(repository.findByClubIdAndKindAndAliasNormalisedAndActiveTrue(club, NameAliasKind.PLAYER, "nazar a"))
                .thenReturn(Optional.of(current));

        aliases.remember(club, NameAliasKind.PLAYER, "Nazar A", player, person);

        verify(repository, never()).save(any());
        verify(repository, never()).saveAndFlush(any());
        assertThat(current.isActive()).isTrue();
    }

    @Test
    void changingThePlayerDeactivatesThePreviousAliasAndWritesANewOne() {
        NameAlias current = NameAlias.builder().clubId(club).kind(NameAliasKind.PLAYER).aliasNormalised("nazar a")
                .targetPlayerProfileId(player).active(true).build();
        when(repository.findByClubIdAndKindAndAliasNormalisedAndActiveTrue(club, NameAliasKind.PLAYER, "nazar a"))
                .thenReturn(Optional.of(current));

        aliases.remember(club, NameAliasKind.PLAYER, "Nazar A", other, person);

        assertThat(current.isActive()).isFalse();
        verify(repository).saveAndFlush(current);
        ArgumentCaptor<NameAlias> saved = ArgumentCaptor.forClass(NameAlias.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getTargetPlayerProfileId()).isEqualTo(other);
        assertThat(saved.getValue().isActive()).isTrue();
        verify(repository, never()).delete(any());
    }

    @Test
    void aPlatformAdminWithNoPersonWritesAnAliasWithANullCreator() {
        aliases.remember(club, NameAliasKind.PLAYER, "Nazar A", player, null);

        ArgumentCaptor<NameAlias> saved = ArgumentCaptor.forClass(NameAlias.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getCreatedBy()).isNull();
    }

    @Test
    void aBlankSpellingOrNoTargetWritesNothing() {
        aliases.remember(club, NameAliasKind.PLAYER, "  ", player, person);
        aliases.remember(club, NameAliasKind.PLAYER, "Nazar A", null, person);

        verify(repository, never()).save(any());
    }

    @Test
    void activeForReadsOnlyThisClubsAliasesByNormalisedSpelling() {
        NameAlias alias = NameAlias.builder().clubId(club).aliasNormalised("nazar a").targetPlayerProfileId(player).active(true).build();
        when(repository.findByClubIdAndKindAndActiveTrueAndAliasNormalisedIn(club, NameAliasKind.PLAYER, Set.of("nazar a")))
                .thenReturn(List.of(alias));

        Map<String, NameAlias> found = aliases.activeFor(club, NameAliasKind.PLAYER, List.of("NAZAR  A", "  "));

        assertThat(found).containsOnlyKeys("nazar a");
        verify(repository, never()).findByClubIdAndKindAndActiveTrueAndAliasNormalisedIn(
                org.mockito.ArgumentMatchers.eq(other), any(), any());
    }

    @Test
    void noSpellingsMeansNoQuery() {
        assertThat(aliases.activeFor(club, NameAliasKind.PLAYER, List.of())).isEmpty();

        verify(repository, never()).findByClubIdAndKindAndActiveTrueAndAliasNormalisedIn(any(), any(), any());
    }
}
