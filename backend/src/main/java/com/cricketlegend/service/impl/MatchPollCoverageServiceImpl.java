package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** See {@link MatchPollCoverageService} and docs/specs/064-unified-availability-polls.md. */
@Service
public class MatchPollCoverageServiceImpl implements MatchPollCoverageService {

    private final SectionAvailabilityWindowMatchRepository windowMatchRepository;
    private final SectionAvailabilityWindowRepository windowRepository;
    private final SectionAvailabilityRoundRepository roundRepository;
    private final MatchAvailabilityPollRepository pollRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;

    public MatchPollCoverageServiceImpl(
            SectionAvailabilityWindowMatchRepository windowMatchRepository,
            SectionAvailabilityWindowRepository windowRepository,
            SectionAvailabilityRoundRepository roundRepository,
            MatchAvailabilityPollRepository pollRepository,
            MatchRepository matchRepository,
            TeamRepository teamRepository) {
        this.windowMatchRepository = windowMatchRepository;
        this.windowRepository = windowRepository;
        this.roundRepository = roundRepository;
        this.pollRepository = pollRepository;
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Coverage resolve(UUID matchId, UUID teamId) {
        Coverage group = resolveGroup(matchId);
        if (group.covered()) {
            return group;
        }
        return pollRepository
                .findByMatchIdAndTeamId(matchId, teamId)
                .map(this::squadCoverage)
                .orElse(Coverage.NONE);
    }

    @Override
    @Transactional(readOnly = true)
    public Coverage resolveAny(UUID matchId) {
        Coverage group = resolveGroup(matchId);
        if (group.covered()) {
            return group;
        }
        List<MatchAvailabilityPoll> polls = pollRepository.findByMatchId(matchId);
        return polls.isEmpty() ? Coverage.NONE : squadCoverage(polls.get(0));
    }

    private Coverage resolveGroup(UUID matchId) {
        return windowMatchRepository
                .findByMatchId(matchId)
                .flatMap(windowMatch -> windowRepository.findById(windowMatch.getWindowId()))
                .map(this::groupCoverage)
                .orElse(Coverage.NONE);
    }

    private Coverage groupCoverage(SectionAvailabilityWindow window) {
        String description = roundRepository
                .findById(window.getRoundId())
                .map(SectionAvailabilityRound::getDescription)
                .orElse(null);
        return new Coverage(Kind.GROUP, null, window.getRoundId(), window.getId(), description);
    }

    private Coverage squadCoverage(MatchAvailabilityPoll poll) {
        Optional<Match> match = matchRepository.findById(poll.getMatchId());
        String teamName = teamRepository.findById(poll.getTeamId()).map(Team::getName).orElse("team");
        String label = match.map(m -> {
                    boolean home = poll.getTeamId().equals(m.getHomeTeamId());
                    String opponent = home
                            ? sideName(m.getAwayTeamId(), m.getAwayTeamName())
                            : sideName(m.getHomeTeamId(), m.getHomeTeamName());
                    return opponent == null ? teamName : teamName + " v " + opponent;
                })
                .orElse(teamName);
        return new Coverage(Kind.SQUAD, poll.getId(), null, null, label);
    }

    private String sideName(UUID teamId, String fallbackName) {
        if (teamId == null) {
            return fallbackName;
        }
        return teamRepository.findById(teamId).map(Team::getName).orElse(fallbackName);
    }
}
