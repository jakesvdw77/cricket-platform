package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.support.ResultPlayerEligibility.Problem;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/113 Test Plan: {@link ResultPlayerEligibility} with mocked repositories. The section rule (in the section,
 * in a descendant, in the parent only, in another section, two sections one matching, no section rows), the age rule
 * (on, off, no date of birth, passes the section but fails the age, no league), a team without a section, and that the
 * queries are batched.
 */
class ResultPlayerEligibilityTest {

    private final PlayerSectionRepository playerSectionRepository = mock(PlayerSectionRepository.class);
    private final SectionRepository sectionRepository = mock(SectionRepository.class);
    private final TeamRepository teamRepository = mock(TeamRepository.class);
    private final AccessService accessService = mock(AccessService.class);
    private final SelectionEligibility selectionEligibility = mock(SelectionEligibility.class);

    private ResultPlayerEligibility eligibility;
    private final UUID clubId = UUID.randomUUID();
    private final UUID parentId = UUID.randomUUID();
    private final UUID sectionId = UUID.randomUUID();
    private final UUID childId = UUID.randomUUID();
    private final UUID otherId = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();
    private final UUID anna = UUID.randomUUID();
    private final UUID bela = UUID.randomUUID();
    private final UUID cato = UUID.randomUUID();
    private final Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamId).build();
    private final Map<UUID, PlayerInfo> players = new HashMap<>();
    private final List<PlayerSection> rows = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        eligibility = new ResultPlayerEligibility(
                playerSectionRepository, sectionRepository, teamRepository, accessService, selectionEligibility);
        Team team = Team.builder().id(teamId).clubId(clubId).sectionId(sectionId).name("Villagers 1").build();
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(team));
        when(sectionRepository.findAllById(anyCollection()))
                .thenReturn(List.of(Section.builder().id(sectionId).clubId(clubId).name("Seniors").build()));
        when(accessService.sectionClosures(any(), anyCollection()))
                .thenReturn(Map.of(sectionId, Set.of(sectionId, childId)));
        when(selectionEligibility.ageProblems(any(Match.class), anyCollection(), any())).thenReturn(Map.of());
        when(playerSectionRepository.findByPlayerProfileIdIn(anyCollection())).thenAnswer(inv -> {
            java.util.Collection<UUID> asked = inv.getArgument(0);
            return rows.stream().filter(r -> asked.contains(r.getPlayerProfileId())).toList();
        });
        players.put(anna, info(anna, "Anna"));
        players.put(bela, info(bela, "Bela"));
        players.put(cato, info(cato, "Cato"));
    }

    private PlayerInfo info(UUID id, String first) {
        return new PlayerInfo(id, clubId, true, first, "Player", null, null);
    }

    private void tagged(UUID player, UUID... sections) {
        for (UUID section : sections) {
            rows.add(PlayerSection.builder().playerProfileId(player).sectionId(section).build());
        }
    }

    private Map<UUID, List<Problem>> homeProblems(UUID... ids) {
        return eligibility.check(match, Map.of(ResultSide.HOME, Set.of(ids)), players)
                .getOrDefault(ResultSide.HOME, Map.of());
    }

    @Test
    void aPlayerInTheTeamsSectionPasses() {
        tagged(anna, sectionId);

        assertThat(homeProblems(anna)).isEmpty();
    }

    @Test
    void aPlayerInADescendantSectionPasses() {
        tagged(anna, childId);

        assertThat(homeProblems(anna)).isEmpty();
    }

    @Test
    void aPlayerOnlyInTheParentSectionIsRefused() {
        tagged(anna, parentId);

        assertThat(homeProblems(anna).get(anna)).containsExactly(
                new Problem(ErrorCode.PLAYER_NOT_IN_SECTION, "Anna Player is not in the Seniors section."));
    }

    @Test
    void aPlayerInAnotherSectionIsRefused() {
        tagged(anna, otherId);

        assertThat(homeProblems(anna).get(anna)).extracting(Problem::code)
                .containsExactly(ErrorCode.PLAYER_NOT_IN_SECTION);
    }

    @Test
    void aPlayerInTwoSectionsOneMatchingPasses() {
        tagged(anna, otherId, sectionId);

        assertThat(homeProblems(anna)).isEmpty();
    }

    @Test
    void aPlayerWithNoSectionRowsIsRefused() {
        tagged(anna);

        assertThat(homeProblems(anna).get(anna)).extracting(Problem::code)
                .containsExactly(ErrorCode.PLAYER_NOT_IN_SECTION);
    }

    @Test
    void theAgeRuleProblemIsReportedAsAgeIneligible() {
        tagged(anna, sectionId);
        when(selectionEligibility.ageProblems(any(Match.class), anyCollection(), any()))
                .thenReturn(Map.of(anna, "Anna Player is 12, below this league's minAge of 14 as at 1 Sep 2026"));

        assertThat(homeProblems(anna).get(anna)).containsExactly(new Problem(ErrorCode.PLAYER_AGE_INELIGIBLE,
                "Anna Player is 12, below this league's minAge of 14 as at 1 Sep 2026"));
    }

    @Test
    void aMissingDateOfBirthIsAnAgeProblemWhenTheLeagueHasARule() {
        tagged(anna, sectionId);
        when(selectionEligibility.ageProblems(any(Match.class), anyCollection(), any())).thenReturn(Map.of(
                anna, "Anna Player has no recorded date of birth; required for this league's age rule"));

        assertThat(homeProblems(anna).get(anna)).extracting(Problem::code)
                .containsExactly(ErrorCode.PLAYER_AGE_INELIGIBLE);
    }

    @Test
    void aPlayerWhoPassesTheSectionButFailsTheAgeGetsOnlyTheAgeProblem() {
        tagged(anna, sectionId);
        tagged(bela, otherId);
        when(selectionEligibility.ageProblems(any(Match.class), anyCollection(), any()))
                .thenReturn(Map.of(anna, "too old"));

        Map<UUID, List<Problem>> problems = homeProblems(anna, bela);

        assertThat(problems.get(anna)).extracting(Problem::code).containsExactly(ErrorCode.PLAYER_AGE_INELIGIBLE);
        assertThat(problems.get(bela)).extracting(Problem::code).containsExactly(ErrorCode.PLAYER_NOT_IN_SECTION);
    }

    @Test
    void aPlayerFailingBothChecksGetsBothProblems() {
        tagged(anna, otherId);
        when(selectionEligibility.ageProblems(any(Match.class), anyCollection(), any()))
                .thenReturn(Map.of(anna, "too young"));

        assertThat(homeProblems(anna).get(anna)).extracting(Problem::code)
                .containsExactly(ErrorCode.PLAYER_NOT_IN_SECTION, ErrorCode.PLAYER_AGE_INELIGIBLE);
    }

    @Test
    void aSideWhoseTeamHasNoSectionIsNotSectionChecked() {
        tagged(anna, otherId);
        when(teamRepository.findAllById(anyCollection()))
                .thenReturn(List.of(Team.builder().id(teamId).clubId(clubId).name("Villagers 1").build()));

        assertThat(homeProblems(anna)).isEmpty();
    }

    @Test
    void aTeamOfAnotherClubIsNotSectionChecked() {
        tagged(anna, otherId);
        when(teamRepository.findAllById(anyCollection()))
                .thenReturn(List.of(Team.builder().id(teamId).clubId(UUID.randomUUID()).sectionId(sectionId).build()));

        assertThat(homeProblems(anna)).isEmpty();
    }

    @Test
    void noPlayersMeansNoQueries() {
        assertThat(eligibility.check(match, Map.of(ResultSide.HOME, Set.of()), players)).isEmpty();

        verify(playerSectionRepository, times(0)).findByPlayerProfileIdIn(anyCollection());
    }

    @Test
    void bothSidesAreCheckedWithOneQueryEachNotOnePerPlayer() {
        UUID awayTeam = UUID.randomUUID();
        UUID awaySection = UUID.randomUUID();
        Match derby = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamId).awayTeamId(awayTeam).build();
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(
                Team.builder().id(teamId).clubId(clubId).sectionId(sectionId).build(),
                Team.builder().id(awayTeam).clubId(clubId).sectionId(awaySection).build()));
        when(accessService.sectionClosures(any(), anyCollection()))
                .thenReturn(Map.of(sectionId, Set.of(sectionId), awaySection, Set.of(awaySection)));
        tagged(anna, sectionId);
        tagged(bela, awaySection);

        Map<ResultSide, Map<UUID, List<Problem>>> out = eligibility.check(
                derby, Map.of(ResultSide.HOME, Set.of(anna, cato), ResultSide.AWAY, Set.of(bela, anna)), players);

        assertThat(out.get(ResultSide.HOME)).containsOnlyKeys(cato);
        assertThat(out.get(ResultSide.AWAY)).containsOnlyKeys(anna);
        verify(playerSectionRepository, times(1)).findByPlayerProfileIdIn(anyCollection());
        verify(teamRepository, times(1)).findAllById(anyCollection());
        verify(sectionRepository, times(1)).findAllById(anyCollection());
        verify(accessService, times(1)).sectionClosures(any(), anyCollection());
        verify(selectionEligibility, times(1)).ageProblems(any(Match.class), anyCollection(), any());
    }

    @Test
    void eligibleIdsKeepsOnlyThosePassingBothChecks() {
        tagged(anna, sectionId);
        tagged(bela, otherId);

        assertThat(eligibility.eligibleIds(match, ResultSide.HOME, List.of(anna, bela), players)).containsExactly(anna);
    }

}
