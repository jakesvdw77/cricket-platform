package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

/** docs/specs/103-player-stats.md: tenancy and section scope for every statistics read. */
@ExtendWith(MockitoExtension.class)
class StatsScopeResolverTest {

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private ClubMatchScope clubMatchScope;

    @Mock
    private Authentication authentication;

    private StatsScopeResolver resolver;

    private final UUID clubId = UUID.randomUUID();
    private final UUID otherClubId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        resolver = new StatsScopeResolver(seasonRepository, leagueRepository, teamRepository, clubMatchScope);
    }

    private StatsScopeResolver.Resolved resolve(UUID seasonId, UUID leagueId, UUID teamId, UUID sectionId) {
        return resolver.resolve(authentication, clubId, seasonId, leagueId, teamId, sectionId, null);
    }

    private void reach(UUID sectionId, UUID teamId, ClubMatchScope.Scope scope) {
        when(clubMatchScope.resolve(authentication, clubId, sectionId, teamId)).thenReturn(scope);
    }

    private static Team team(UUID id, UUID sectionId) {
        return Team.builder().id(id).sectionId(sectionId).build();
    }

    // ---- 404: another club's or unknown ----

    @Test
    void anUnknownSeasonIsNotFound() {
        UUID seasonId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolve(seasonId, null, null, null)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(clubMatchScope);
    }

    @Test
    void anotherClubsSeasonIsNotFound() {
        UUID seasonId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId))
                .thenReturn(Optional.of(Season.builder().id(seasonId).clubId(otherClubId).build()));

        assertThatThrownBy(() -> resolve(seasonId, null, null, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anUnknownLeagueIsNotFound() {
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolve(null, leagueId, null, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anotherClubsLeagueIsNotFound() {
        UUID leagueId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId))
                .thenReturn(Optional.of(League.builder().id(leagueId).clubId(otherClubId).build()));

        assertThatThrownBy(() -> resolve(null, leagueId, null, null)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void aSectionOrTeamThatIsNotFoundIsPropagatedAs404() {
        UUID teamId = UUID.randomUUID();
        when(clubMatchScope.resolve(authentication, clubId, null, teamId)).thenThrow(new NotFoundException("Team"));

        assertThatThrownBy(() -> resolve(null, null, teamId, null)).isInstanceOf(NotFoundException.class);
    }

    // ---- 403: outside the caller's reach ----

    @Test
    void aSectionOutsideTheCallersReachIsForbiddenNotNotFound() {
        UUID sectionId = UUID.randomUUID();
        when(clubMatchScope.resolve(authentication, clubId, sectionId, null))
                .thenThrow(new AccessDeniedException("section"));

        assertThatThrownBy(() -> resolve(null, null, null, sectionId))
                .isInstanceOf(AccessDeniedException.class)
                .isNotInstanceOf(NotFoundException.class);
    }

    // ---- the scope ----

    @Test
    void anUnrestrictedCallerGetsAnUnrestrictedScope() {
        UUID seasonId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        when(seasonRepository.findById(seasonId))
                .thenReturn(Optional.of(Season.builder().id(seasonId).clubId(clubId).build()));
        when(leagueRepository.findById(leagueId))
                .thenReturn(Optional.of(League.builder().id(leagueId).clubId(clubId).build()));
        reach(null, null, new ClubMatchScope.Scope(null, null, false));

        StatsScopeResolver.Resolved resolved = resolver.resolve(
                authentication, clubId, seasonId, leagueId, null, null, StatsScope.Competition.LEAGUE);

        assertThat(resolved.nothingInReach()).isFalse();
        StatsScope scope = resolved.scope();
        assertThat(scope.clubId()).isEqualTo(clubId);
        assertThat(scope.seasonId()).isEqualTo(seasonId);
        assertThat(scope.leagueId()).isEqualTo(leagueId);
        assertThat(scope.competition()).isEqualTo(StatsScope.Competition.LEAGUE);
        assertThat(scope.sectionRestricted()).isFalse();
        assertThat(scope.sectionTeamIds()).isNull();
    }

    @Test
    void aSectionScopedCallerIsNarrowedToTheTeamsOfTheirSections() {
        UUID inSection = UUID.randomUUID();
        UUID otherSection = UUID.randomUUID();
        UUID teamIn = UUID.randomUUID();
        UUID teamOut = UUID.randomUUID();
        reach(null, null, new ClubMatchScope.Scope(Set.of(inSection), null, false));
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of(team(teamIn, inSection), team(teamOut, otherSection)));

        StatsScopeResolver.Resolved resolved = resolve(null, null, null, null);

        assertThat(resolved.nothingInReach()).isFalse();
        assertThat(resolved.scope().sectionRestricted()).isTrue();
        assertThat(resolved.scope().sectionTeamIds()).containsExactly(teamIn);
    }

    @Test
    void anEmptyReachIsNothingInReach() {
        reach(null, null, new ClubMatchScope.Scope(Set.of(), null, true));
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of());

        StatsScopeResolver.Resolved resolved = resolve(null, null, null, null);

        assertThat(resolved.nothingInReach()).isTrue();
        assertThat(resolved.scope().sectionRestricted()).isTrue();
    }

    @Test
    void sectionsWithoutTeamsAreNothingInReach() {
        UUID sectionId = UUID.randomUUID();
        reach(null, null, new ClubMatchScope.Scope(Set.of(sectionId), null, false));
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of(team(UUID.randomUUID(), UUID.randomUUID())));

        assertThat(resolve(null, null, null, null).nothingInReach()).isTrue();
    }

    @Test
    void aTeamOutsideTheChosenSectionIsNothingInReach() {
        UUID teamId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamSection = UUID.randomUUID();
        reach(sectionId, teamId, new ClubMatchScope.Scope(Set.of(teamSection), teamId, true));
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of(team(teamId, teamSection)));

        StatsScopeResolver.Resolved resolved = resolve(null, null, teamId, sectionId);

        assertThat(resolved.nothingInReach()).isTrue();
        assertThat(resolved.scope().teamId()).isEqualTo(teamId);
    }

    // ---- query parameters ----

    @Test
    void theSectionTeamParameterIsNeverEmpty() {
        UUID team = UUID.randomUUID();

        List<UUID> unrestricted = StatsScopeResolver.sectionTeamParameter(
                new StatsScope(clubId, null, null, null, null, null));
        List<UUID> emptyRestricted = StatsScopeResolver.sectionTeamParameter(
                new StatsScope(clubId, null, null, null, Set.of(), null));
        List<UUID> restricted = StatsScopeResolver.sectionTeamParameter(
                new StatsScope(clubId, null, null, null, Set.of(team), null));

        assertThat(unrestricted).hasSize(1).isEqualTo(emptyRestricted);
        assertThat(unrestricted).doesNotContain(team);
        assertThat(restricted).containsExactly(team);
    }

    @Test
    void theCompetitionNameIsNullOrTheEnumName() {
        assertThat(StatsScopeResolver.competitionName(new StatsScope(clubId, null, null, null, null, null))).isNull();
        assertThat(StatsScopeResolver.competitionName(
                        new StatsScope(clubId, null, null, null, null, StatsScope.Competition.FRIENDLY)))
                .isEqualTo("FRIENDLY");
    }
}
