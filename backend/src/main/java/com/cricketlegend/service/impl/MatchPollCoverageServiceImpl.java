package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
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

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<PollRef>> pollsForMatches(Collection<UUID> matchIds) {
        Map<UUID, List<PollRef>> result = new LinkedHashMap<>();
        for (UUID matchId : matchIds) {
            result.put(matchId, new ArrayList<>());
        }
        if (result.isEmpty()) {
            return result;
        }
        List<SectionAvailabilityWindowMatch> links = windowMatchRepository.findByMatchIdIn(result.keySet());
        Map<UUID, SectionAvailabilityWindow> windowsById = new HashMap<>();
        if (!links.isEmpty()) {
            windowsById = windowRepository
                    .findAllById(links.stream().map(SectionAvailabilityWindowMatch::getWindowId).distinct().toList())
                    .stream()
                    .collect(Collectors.toMap(SectionAvailabilityWindow::getId, w -> w));
        }
        for (SectionAvailabilityWindowMatch link : links) {
            SectionAvailabilityWindow window = windowsById.get(link.getWindowId());
            if (window != null && result.get(link.getMatchId()).isEmpty()) {
                result.get(link.getMatchId()).add(new PollRef(
                        AvailabilityPollType.GROUP, null, window.getRoundId(), window.getRoundId(), window.isOpen()));
            }
        }
        for (MatchAvailabilityPoll poll : pollRepository.findByMatchIdIn(result.keySet())) {
            List<PollRef> refs = result.get(poll.getMatchId());
            boolean groupCovered = !refs.isEmpty() && refs.get(0).type() == AvailabilityPollType.GROUP;
            if (!groupCovered) {
                refs.add(new PollRef(AvailabilityPollType.SQUAD, poll.getTeamId(), poll.getId(), null, poll.isOpen()));
            }
        }
        return result;
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
