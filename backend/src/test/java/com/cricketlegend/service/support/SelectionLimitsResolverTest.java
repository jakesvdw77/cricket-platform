package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.SelectionLimitsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.service.support.SelectionLimitsResolver.LeagueSeason;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for {@link SelectionLimitsResolver} per docs/specs/076-team-selection.md section 4 and
 * its Test Plan: 11 plus a 12th man without a league, the league's size clamped to 12, the 12th man
 * only where the (league, season) playing conditions allow substitutions and places remain below 12.
 */
@ExtendWith(MockitoExtension.class)
class SelectionLimitsResolverTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private LeaguePlayingConditionsRepository conditionsRepository;

    private SelectionLimitsResolver resolver;
    private final UUID seasonId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        resolver = new SelectionLimitsResolver(leagueRepository, conditionsRepository);
    }

    private League league(int maxPlayingXiSize) {
        return League.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID()).name("L")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(maxPlayingXiSize).active(true).build();
    }

    private LeaguePlayingConditions conditions(League league, UUID season, boolean allowSubstitutions) {
        return LeaguePlayingConditions.builder().leagueId(league.getId()).seasonId(season)
                .allowSubstitutions(allowSubstitutions).build();
    }

    private Match matchIn(League league) {
        return Match.builder().id(UUID.randomUUID()).clubId(league.getClubId()).leagueId(league.getId())
                .seasonId(seasonId).matchDate(Instant.now()).active(true).build();
    }

    private SelectionLimitsDto limitsFor(League league, LeaguePlayingConditions... conditions) {
        when(leagueRepository.findAllById(any())).thenReturn(List.of(league));
        when(conditionsRepository.findByLeagueIdInAndSeasonIdIn(any(), any())).thenReturn(List.of(conditions));
        return resolver.limits(matchIn(league));
    }

    @Test
    void aMatchWithNoLeagueHasElevenPlacesAndATwelfthMan() {
        Match friendly = Match.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID()).seasonId(seasonId)
                .matchDate(Instant.now()).active(true).build();

        assertThat(resolver.limits(friendly)).isEqualTo(new SelectionLimitsDto(11, true, 12));
    }

    @Test
    void aLeagueOfElevenWithSubstitutionsAllowedHasATwelfthMan() {
        League league = league(11);

        assertThat(limitsFor(league, conditions(league, seasonId, true))).isEqualTo(new SelectionLimitsDto(11, true, 12));
    }

    @Test
    void aLeagueOfElevenWithSubstitutionsNotAllowedHasNoTwelfthMan() {
        League league = league(11);

        assertThat(limitsFor(league, conditions(league, seasonId, false))).isEqualTo(new SelectionLimitsDto(11, false, 11));
    }

    @Test
    void aLeagueOfElevenWithNoConditionsRowHasNoTwelfthMan() {
        assertThat(limitsFor(league(11))).isEqualTo(new SelectionLimitsDto(11, false, 11));
    }

    @Test
    void aLeagueOfTwelveHasTwelvePlacesAndNeverATwelfthManEvenWhenSubstitutionsAreAllowed() {
        League league = league(12);

        assertThat(limitsFor(league, conditions(league, seasonId, true))).isEqualTo(new SelectionLimitsDto(12, false, 12));
    }

    @Test
    void aLeagueOfFourteenIsClampedToTwelve() {
        League league = league(14);

        assertThat(limitsFor(league, conditions(league, seasonId, true))).isEqualTo(new SelectionLimitsDto(12, false, 12));
    }

    @Test
    void conditionsOfAnotherSeasonDoNotApply() {
        League league = league(11);

        assertThat(limitsFor(league, conditions(league, UUID.randomUUID(), true)))
                .isEqualTo(new SelectionLimitsDto(11, false, 11));
    }

    @Test
    void limitsOfALeagueThatDoesNotExistThrowsNotFoundException() {
        League league = league(11);
        when(leagueRepository.findAllById(any())).thenReturn(List.of());
        when(conditionsRepository.findByLeagueIdInAndSeasonIdIn(any(), any())).thenReturn(List.of());

        assertThatThrownBy(() -> resolver.limits(matchIn(league))).isInstanceOf(NotFoundException.class);
    }

    @Test
    void theBatchFormResolvesEveryPairWithOneLeaguesQueryAndOneConditionsQuery() {
        League open = league(11);
        League big = league(14);
        UUID otherSeason = UUID.randomUUID();
        LeagueSeason openNow = new LeagueSeason(open.getId(), seasonId);
        LeagueSeason openLater = new LeagueSeason(open.getId(), otherSeason);
        LeagueSeason bigNow = new LeagueSeason(big.getId(), seasonId);
        LeagueSeason missing = new LeagueSeason(UUID.randomUUID(), seasonId);
        when(leagueRepository.findAllById(any())).thenReturn(List.of(open, big));
        when(conditionsRepository.findByLeagueIdInAndSeasonIdIn(any(), any()))
                .thenReturn(List.of(conditions(open, seasonId, true), conditions(open, otherSeason, false)));

        Map<LeagueSeason, SelectionLimitsDto> result = resolver.limitsFor(Set.of(openNow, openLater, bigNow, missing));

        assertThat(result.get(openNow)).isEqualTo(new SelectionLimitsDto(11, true, 12));
        assertThat(result.get(openLater)).isEqualTo(new SelectionLimitsDto(11, false, 11));
        assertThat(result.get(bigNow)).isEqualTo(new SelectionLimitsDto(12, false, 12));
        assertThat(result).doesNotContainKey(missing);
        verify(leagueRepository, times(1)).findAllById(any());
        verify(conditionsRepository, times(1)).findByLeagueIdInAndSeasonIdIn(any(), any());
    }

    @Test
    void theBatchFormWithNoPairsMakesNoQueries() {
        assertThat(resolver.limitsFor(Set.of())).isEmpty();
        org.mockito.Mockito.verifyNoInteractions(leagueRepository, conditionsRepository);
    }
}
