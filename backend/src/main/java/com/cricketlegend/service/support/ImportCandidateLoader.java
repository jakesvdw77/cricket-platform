package com.cricketlegend.service.support;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md, stage 3 and D4: the registered players a name of ours may be matched to.
 * For each of the match's sides that is one of the club's teams: that match's selection for the team (including the
 * 12th man) plus the team's squad for the match's season, kept only when they pass {@link ResultPlayerEligibility}
 * (section and age, spec 113). Never the whole club: a name outside both is a guest the
 * manager can link with the normal picker. Read only.
 */
@Component
public class ImportCandidateLoader {

    /** A registered player a name may become, with the batting order the selection planned for him (null if none). */
    public record OurCandidate(NameCandidate name, Integer plannedBattingOrder) {}

    /** The candidates of one of our sides. */
    public record SideCandidates(ResultSide side, UUID teamId, List<OurCandidate> candidates) {

        public List<NameCandidate> names() {
            return candidates.stream().map(OurCandidate::name).toList();
        }

        public OurCandidate find(UUID playerProfileId) {
            return candidates.stream().filter(c -> c.name().id().equals(playerProfileId)).findFirst().orElse(null);
        }
    }

    private final MatchSideRepository matchSideRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final TeamSquadMemberRepository squadRepository;
    private final SelectionEligibility eligibility;
    private final ResultPlayerEligibility resultEligibility;

    public ImportCandidateLoader(
            MatchSideRepository matchSideRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            TeamSquadMemberRepository squadRepository,
            SelectionEligibility eligibility,
            ResultPlayerEligibility resultEligibility) {
        this.matchSideRepository = matchSideRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.squadRepository = squadRepository;
        this.eligibility = eligibility;
        this.resultEligibility = resultEligibility;
    }

    /** The candidates for each side of the match that is one of the club's teams; the opposition has none. */
    public Map<ResultSide, SideCandidates> load(UUID clubId, Match match) {
        Map<ResultSide, SideCandidates> bySide = new EnumMap<>(ResultSide.class);
        load(clubId, match, ResultSide.HOME, match.getHomeTeamId(), bySide);
        load(clubId, match, ResultSide.AWAY, match.getAwayTeamId(), bySide);
        return bySide;
    }

    private void load(
            UUID clubId, Match match, ResultSide side, UUID teamId, Map<ResultSide, SideCandidates> bySide) {
        if (teamId == null) {
            return;
        }
        Map<UUID, Integer> orderById = new LinkedHashMap<>();
        MatchSide matchSide = matchSideRepository.findByMatchIdAndTeamId(match.getId(), teamId).orElse(null);
        if (matchSide != null) {
            for (MatchSidePlayer player : matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(matchSide.getId())) {
                orderById.putIfAbsent(player.getPlayerProfileId(), player.getBattingOrder());
            }
            if (matchSide.getTwelfthManPlayerId() != null) {
                orderById.put(matchSide.getTwelfthManPlayerId(), null);
            }
        }
        if (match.getSeasonId() != null) {
            for (TeamSquadMember member : squadRepository.findByTeamIdAndSeasonId(teamId, match.getSeasonId())) {
                orderById.putIfAbsent(member.getPlayerProfileId(), null);
            }
        }
        Map<UUID, PlayerInfo> infos = eligibility.loadPlayers(orderById.keySet());
        Set<UUID> clubPlayers = orderById.keySet().stream()
                .filter(id -> infos.get(id) != null && clubId.equals(infos.get(id).clubId()))
                .collect(Collectors.toSet());
        // docs/specs/113: a player outside the team's section or the league's age rule is never offered, so the name
        // stays a guest for the manager to resolve
        Set<UUID> eligible = resultEligibility.eligibleIds(match, side, clubPlayers, infos);
        List<OurCandidate> candidates = new ArrayList<>();
        orderById.forEach((id, order) -> {
            PlayerInfo info = infos.get(id);
            if (info != null && eligible.contains(id)) {
                candidates.add(new OurCandidate(new NameCandidate(id, info.firstName(), info.lastName()), order));
            }
        });
        bySide.put(side, new SideCandidates(side, teamId, candidates));
    }
}
