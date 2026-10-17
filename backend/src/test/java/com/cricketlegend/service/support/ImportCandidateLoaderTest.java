package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.support.ImportCandidateLoader.SideCandidates;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/113 Test Plan, import tier: {@link ImportCandidateLoader} offers only the squad members who pass {@link
 * ResultPlayerEligibility}, so a name that would match an ineligible player stays a guest.
 */
class ImportCandidateLoaderTest {

    private final MatchSideRepository matchSideRepository = mock(MatchSideRepository.class);
    private final MatchSidePlayerRepository matchSidePlayerRepository = mock(MatchSidePlayerRepository.class);
    private final TeamSquadMemberRepository squadRepository = mock(TeamSquadMemberRepository.class);
    private final SelectionEligibility selectionEligibility = mock(SelectionEligibility.class);
    private final ResultPlayerEligibility resultEligibility = mock(ResultPlayerEligibility.class);
    private final ImportCandidateLoader loader = new ImportCandidateLoader(
            matchSideRepository, matchSidePlayerRepository, squadRepository, selectionEligibility, resultEligibility);

    private final UUID clubId = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final UUID anna = UUID.randomUUID();
    private final UUID eli = UUID.randomUUID();
    private final Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamId).seasonId(seasonId).build();

    @Test
    void anIneligibleSquadMemberIsNotACandidateAndAnEligibleOneIs() {
        when(matchSideRepository.findByMatchIdAndTeamId(match.getId(), teamId)).thenReturn(Optional.<MatchSide>empty());
        when(squadRepository.findByTeamIdAndSeasonId(teamId, seasonId)).thenReturn(List.of(
                TeamSquadMember.builder().teamId(teamId).seasonId(seasonId).playerProfileId(anna).build(),
                TeamSquadMember.builder().teamId(teamId).seasonId(seasonId).playerProfileId(eli).build()));
        Map<UUID, PlayerInfo> infos = Map.of(
                anna, new PlayerInfo(anna, clubId, true, "Anna", "Player", null, null),
                eli, new PlayerInfo(eli, clubId, true, "Eli", "Player", null, null));
        when(selectionEligibility.loadPlayers(anyCollection())).thenReturn(infos);
        when(resultEligibility.eligibleIds(any(), any(), anyCollection(), any())).thenReturn(Set.of(anna));

        SideCandidates home = loader.load(clubId, match).get(ResultSide.HOME);

        assertThat(home.names()).extracting(NameCandidate::fullName).containsExactly("Anna Player");
    }
}
