package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.SectionAvailabilityFixtureGroupDto;
import com.cricketlegend.dto.SectionAvailabilityFixtureMatchDto;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import com.cricketlegend.service.SectionAvailabilityFixtureGroupResolver;
import com.cricketlegend.service.SectionAvailabilityMatchResolver;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * See {@link SectionAvailabilityFixtureGroupResolver} and
 * docs/specs/063-section-availability-and-flexible-squads.md. Every candidate row is resolved
 * per-side (a match qualifies once per team of this section it involves — home,
 * away, or in the rare intra-section-derby case, both), mirroring the pre-revision {@code
 * SectionAvailabilityRoundServiceImpl}'s own per-side match-row shape.
 */
@Service
public class SectionAvailabilityFixtureGroupResolverImpl implements SectionAvailabilityFixtureGroupResolver {

    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ofPattern("EEEE d", Locale.ENGLISH);
    private static final DateTimeFormatter DAY_WITH_MONTH_FORMAT =
            DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.ENGLISH);

    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final SectionRepository sectionRepository;
    private final LeagueRepository leagueRepository;
    private final SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;
    private final SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;
    private final SectionAvailabilityMatchResolver matchResolver;
    private final MatchPollCoverageService coverageService;

    public SectionAvailabilityFixtureGroupResolverImpl(
            MatchRepository matchRepository,
            TeamRepository teamRepository,
            SectionRepository sectionRepository,
            LeagueRepository leagueRepository,
            SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository,
            SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository,
            SectionAvailabilityMatchResolver matchResolver,
            MatchPollCoverageService coverageService) {
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
        this.sectionRepository = sectionRepository;
        this.leagueRepository = leagueRepository;
        this.sectionAvailabilityWindowRepository = sectionAvailabilityWindowRepository;
        this.sectionAvailabilityRoundRepository = sectionAvailabilityRoundRepository;
        this.matchResolver = matchResolver;
        this.coverageService = coverageService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SectionAvailabilityFixtureGroupDto> resolveGroups(UUID clubId, UUID sectionId) {
        List<Match> upcomingMatches =
                matchRepository.findUpcomingMatchesBySection(clubId, sectionId, Instant.now());

        // Each row pairs a candidate match dto with its own resolved windowDate — a plain
        // Map.Entry rather than a private nested type, so this class doesn't introduce a second
        // class under com.cricketlegend.service.impl that ArchUnit's "every service.impl class is
        // *Impl and @Service" rule would otherwise flag.
        List<Map.Entry<SectionAvailabilityFixtureMatchDto, LocalDate>> rows = new ArrayList<>();
        for (Match match : upcomingMatches) {
            addRowIfQualifies(sectionId, match, match.getHomeTeamId(), match.getAwayTeamId(), match.getAwayTeamName(), rows);
            // A match whose home and away team are the same id (or a section-internal derby) must
            // still appear once: both sides resolve to the same section/date/day-part window.
            if (!java.util.Objects.equals(match.getAwayTeamId(), match.getHomeTeamId())) {
                addRowIfQualifies(sectionId, match, match.getAwayTeamId(), match.getHomeTeamId(), match.getHomeTeamName(), rows);
            }
        }
        rows.sort(java.util.Comparator
                .comparing((Map.Entry<SectionAvailabilityFixtureMatchDto, LocalDate> row) -> row.getValue())
                .thenComparing(row -> row.getKey().matchDate()));

        String sectionName = sectionRepository.findById(sectionId).map(Section::getName).orElse("");

        List<SectionAvailabilityFixtureGroupDto> groups = new ArrayList<>();
        List<Map.Entry<SectionAvailabilityFixtureMatchDto, LocalDate>> currentGroupRows = new ArrayList<>();
        LocalDate currentGroupLatestDate = null;

        for (Map.Entry<SectionAvailabilityFixtureMatchDto, LocalDate> row : rows) {
            LocalDate windowDate = row.getValue();
            // Same calendar date (e.g. a Saturday morning and afternoon fixture) or the very next day
            // joins the current group; anything later starts a new one.
            if (currentGroupLatestDate != null
                    && (windowDate.equals(currentGroupLatestDate) || windowDate.equals(currentGroupLatestDate.plusDays(1)))) {
                currentGroupLatestDate = windowDate;
                currentGroupRows.add(row);
                continue;
            }
            if (!currentGroupRows.isEmpty()) {
                groups.add(buildGroup(currentGroupRows, sectionName));
            }
            currentGroupRows = new ArrayList<>();
            currentGroupRows.add(row);
            currentGroupLatestDate = windowDate;
        }
        if (!currentGroupRows.isEmpty()) {
            groups.add(buildGroup(currentGroupRows, sectionName));
        }
        return groups;
    }

    private void addRowIfQualifies(
            UUID sectionId,
            Match match,
            UUID teamId,
            UUID opponentTeamId,
            String opponentFallbackName,
            List<Map.Entry<SectionAvailabilityFixtureMatchDto, LocalDate>> rows) {
        if (teamId == null) {
            return;
        }
        Team team = teamRepository.findById(teamId).orElse(null);
        if (team == null || !team.getSectionId().equals(sectionId)) {
            return;
        }
        String opponentLabel = opponentTeamId != null
                ? teamRepository.findById(opponentTeamId).map(Team::getName).orElse(opponentFallbackName)
                : opponentFallbackName;
        String leagueName = match.getLeagueId() == null ? null : findLeagueName(match.getLeagueId());

        SectionAvailabilityMatchResolver.WindowKey key = matchResolver.resolveWindowKey(team, match);
        Optional<SectionAvailabilityWindow> existingWindow = sectionAvailabilityWindowRepository
                .findBySectionIdAndWindowDateAndDayPart(key.sectionId(), key.windowDate(), key.dayPart());
        // Coverage is match+team scoped (docs/specs/064): a squad poll covers only its own team's
        // side, so in an intra-section derby one side's poll must not disable the other side's row;
        // a group poll (any window link) covers every involved team. A group window already
        // occupying this match's bracket also blocks it (round creation rejects such a bracket),
        // so it is flagged too, naming that window's round.
        MatchPollCoverageService.Coverage coverage = coverageService.resolve(match.getId(), teamId);
        AvailabilityPollType existingPollType = null;
        UUID existingPollId = null;
        String existingPollLabel = null;
        if (coverage.covered()) {
            existingPollType = coverage.kind() == MatchPollCoverageService.Kind.SQUAD
                    ? AvailabilityPollType.SQUAD
                    : AvailabilityPollType.GROUP;
            existingPollId = coverage.coveringPollId();
            existingPollLabel = coverage.label();
        } else if (existingWindow.isPresent()) {
            SectionAvailabilityRound existingRound = sectionAvailabilityRoundRepository
                    .findById(existingWindow.get().getRoundId())
                    .orElse(null);
            existingPollType = AvailabilityPollType.GROUP;
            existingPollId = existingWindow.get().getRoundId();
            existingPollLabel = existingRound == null ? null : existingRound.getDescription();
        }
        boolean alreadyPolled = existingPollType != null;

        SectionAvailabilityFixtureMatchDto dto = new SectionAvailabilityFixtureMatchDto(
                match.getId(),
                teamId,
                team.getName(),
                opponentLabel,
                match.getMatchDate(),
                key.dayPart(),
                leagueName,
                alreadyPolled,
                existingPollType,
                existingPollId,
                existingPollLabel);
        rows.add(new AbstractMap.SimpleEntry<>(dto, key.windowDate()));
    }

    private String findLeagueName(UUID leagueId) {
        return leagueRepository.findById(leagueId).map(League::getName).orElse(null);
    }

    private SectionAvailabilityFixtureGroupDto buildGroup(
            List<Map.Entry<SectionAvailabilityFixtureMatchDto, LocalDate>> groupRows, String sectionName) {
        LocalDate startDate = groupRows.get(0).getValue();
        LocalDate endDate = groupRows.get(groupRows.size() - 1).getValue();
        List<SectionAvailabilityFixtureMatchDto> matches =
                groupRows.stream().map(Map.Entry::getKey).toList();
        return new SectionAvailabilityFixtureGroupDto(
                buildSuggestedDescription(startDate, endDate, sectionName), startDate, endDate, matches);
    }

    private String buildSuggestedDescription(LocalDate startDate, LocalDate endDate, String sectionName) {
        String dateRange = startDate.equals(endDate)
                ? endDate.format(DAY_WITH_MONTH_FORMAT)
                : startDate.format(DAY_FORMAT) + " - " + endDate.format(DAY_WITH_MONTH_FORMAT);
        return dateRange + " - " + sectionName + " fixtures";
    }
}
