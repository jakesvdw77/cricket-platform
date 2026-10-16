package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.TeamMappingDto;
import com.cricketlegend.service.support.ImportTeamMapper.Side;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/104-match-results-import-adaptors.md, stage 2 and team names across scoring systems: how a file team is
 * proposed to a side of the match, and that a number or age group is never read loosely. The name aliases are mocked
 * (nothing remembered). Invented club names; the spellings are the ones real scoring systems use.
 */
class ImportTeamMapperTest {

    private final ImportTeamMapper mapper = new ImportTeamMapper(mock(NameAliases.class));
    private final UUID club = UUID.randomUUID();

    private static Side home(String name) {
        return new Side(ResultSide.HOME, name, UUID.randomUUID());
    }

    private static Side away(String name) {
        return new Side(ResultSide.AWAY, name, null);
    }

    private static ImportedResultDto.Team team(String key, String name) {
        return new ImportedResultDto.Team(key, name, null, null);
    }

    private List<TeamMappingDto> propose(Side home, Side away, String a, String b) {
        return mapper.propose(club, List.of(team("A", a), team("B", b)), home, away);
    }

    @Test
    void anAgeGroupWrittenDifferentlyIsProposedAsNormalisedNotUnrecognised() {
        List<TeamMappingDto> mapping = propose(home("Irene Villagers U15"), away("Pretoria A"), "IRENE VILLAGERS UNDER 15", "PRETORIA A");

        assertThat(mapping.get(0).side()).isEqualTo(ResultSide.HOME);
        assertThat(mapping.get(0).exactness()).isEqualTo(ImportExactness.NORMALISED);
        assertThat(mapping.get(0).reason()).contains("age group");
        assertThat(mapping.get(1).side()).isEqualTo(ResultSide.AWAY);
        assertThat(mapping.get(1).exactness()).isEqualTo(ImportExactness.EXACT);
    }

    @Test
    void aDifferentNumberIsNeverPlacedOnTheOtherNumbersSide() {
        List<TeamMappingDto> mapping = propose(home("Irene Villagers 1"), away("CBC 1"), "Irene Villagers 2", "CBC 2");

        assertThat(mapping).allSatisfy(m -> assertThat(m.side()).isNull());
        assertThat(mapping).allSatisfy(m -> assertThat(m.closestSide()).isNull());
    }

    @Test
    void aNumberedNameDoesNotMatchTheSameNameWithoutOne() {
        List<TeamMappingDto> mapping = propose(home("Irene Villagers"), away("CBC"), "Irene Villagers 1", "Cbc");

        // Not placed by name: the "HOME" it carries is only the other side of the match by elimination, left for the manager.
        assertThat(mapping.get(0).exactness()).isEqualTo(ImportExactness.UNRESOLVED);
        assertThat(mapping.get(0).reason()).isEqualTo("The other side of the match.");
        assertThat(mapping.get(1).side()).isEqualTo(ResultSide.AWAY);
    }

    @Test
    void whenNeitherIsPlacedEachGetsAClosestSideHintAndNothingIsChosenForTheManager() {
        List<TeamMappingDto> mapping = propose(
                home("Irene Villagers U15"), away("Pretoria Gymnasium A"), "Irene Vilagers U15", "Pretoria Gymnasium");

        assertThat(mapping).allSatisfy(m -> {
            assertThat(m.side()).isNull();
            assertThat(m.exactness()).isEqualTo(ImportExactness.UNRESOLVED);
        });
        assertThat(mapping.get(0).closestSide()).isEqualTo(ResultSide.HOME);
        assertThat(mapping.get(1).closestSide()).isEqualTo(ResultSide.AWAY);
    }

    @Test
    void whenBothPointAtTheSameSideOnlyTheNearerOneGetsTheHint() {
        List<TeamMappingDto> mapping = propose(
                home("Irene Villagers U15"), away("Zzz Wanderers"), "Irene Vilagers U15", "Irene Villagers");

        long hinted = mapping.stream().filter(m -> m.closestSide() != null).count();
        assertThat(hinted).isLessThanOrEqualTo(1);
    }

    @Test
    void withOneTeamPlacedTheOtherIsProposedByEliminationAndCarriesNoHint() {
        List<TeamMappingDto> mapping = propose(home("Irene Villagers U15"), away("Pretoria A"), "Irene Villagers Under 15", "Unknown Side");

        assertThat(mapping.get(1).side()).isEqualTo(ResultSide.AWAY);
        assertThat(mapping.get(1).exactness()).isEqualTo(ImportExactness.UNRESOLVED);
        assertThat(mapping.get(1).closestSide()).isNull();
    }
}
