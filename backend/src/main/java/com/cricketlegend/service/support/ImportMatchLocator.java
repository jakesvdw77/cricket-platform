package com.cricketlegend.service.support;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.ExistingResultDto;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportMatchReason;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.MatchCandidateDto;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.TeamMappingDto;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchSpecifications;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.ResultService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md, stage 1: the matches of the club an import could belong to, with the
 * evidence for each. Candidates come through {@link MatchService#listMatching} (so the caller's section narrowing is the
 * Matches list's), are active, and are within one day of the document's date, plus the match the provider id was
 * already imported onto, the document's own {@code matchId} and the match the import was launched from. Nothing is
 * ever chosen for the manager. Read only; existing results come through {@link ResultService}.
 */
@Component
public class ImportMatchLocator {

    /** A candidate and the proposed side of each file team against it. */
    public record Located(MatchCandidateDto candidate, List<TeamMappingDto> teamMapping) {}

    private static final int MAX_CANDIDATES = 25;
    private static final int MIN_TEXT_MATCH = 4;

    private final MatchService matchService;
    private final ResultService resultService;
    private final TeamRepository teamRepository;
    private final LeagueRepository leagueRepository;
    private final ImportTeamMapper teamMapper;

    public ImportMatchLocator(
            MatchService matchService,
            ResultService resultService,
            TeamRepository teamRepository,
            LeagueRepository leagueRepository,
            ImportTeamMapper teamMapper) {
        this.matchService = matchService;
        this.resultService = resultService;
        this.teamRepository = teamRepository;
        this.leagueRepository = leagueRepository;
        this.teamMapper = teamMapper;
    }

    /** The candidates, strongest evidence first. {@code launchedFrom} is the match the import was started from, if any. */
    public List<Located> locate(Authentication authentication, UUID clubId, ImportedResultDto document, UUID launchedFrom) {
        ImportedResultDto.Match fileMatch = document.match();
        var origin = ImportOrigins.of(document);
        Optional<ExistingResultDto> imported = origin.externalId() == null
                ? Optional.empty()
                : resultService.findImported(clubId, origin.source(), origin.externalId());
        UUID given = fileMatch == null ? null : fileMatch.matchId();

        Set<UUID> ids = new LinkedHashSet<>();
        imported.ifPresent(existing -> ids.add(existing.matchId()));
        if (given != null) {
            ids.add(given);
        }
        if (launchedFrom != null) {
            ids.add(launchedFrom);
        }
        LocalDate date = fileMatch == null ? null : fileMatch.date();
        Specification<Match> scope = null;
        if (!ids.isEmpty()) {
            scope = (root, query, cb) -> root.get("id").in(ids);
        }
        if (date != null) {
            Specification<Match> window = MatchSpecifications.matchDateBetween(
                    ServerClock.startOfDay(date.minusDays(1)), ServerClock.startOfDay(date.plusDays(2)));
            scope = scope == null ? window : scope.or(window);
        }
        if (scope == null) {
            return List.of();
        }
        List<MatchDto> matches = matchService
                .listMatching(authentication, clubId, null, null, null, null, null,
                        MatchSpecifications.active().and(scope), PageRequest.of(0, MAX_CANDIDATES))
                .getContent();
        if (matches.isEmpty()) {
            return List.of();
        }

        Map<UUID, Team> teams = teamRepository
                .findAllById(matches.stream()
                        .flatMap(m -> java.util.stream.Stream.of(m.homeTeamId(), m.awayTeamId()))
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Team::getId, t -> t));
        Map<UUID, League> leagues = leagueRepository
                .findAllById(matches.stream().map(MatchDto::leagueId).filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(League::getId, l -> l));
        Map<UUID, ExistingResultDto> existing =
                resultService.existingResults(clubId, matches.stream().map(MatchDto::id).toList());

        List<Located> located = new ArrayList<>();
        for (MatchDto match : matches) {
            String homeName = sideName(match.homeTeamId(), match.homeTeamName(), teams);
            String awayName = sideName(match.awayTeamId(), match.awayTeamName(), teams);
            List<TeamMappingDto> mapping = teamMapper.propose(
                    clubId, document.teams(),
                    new ImportTeamMapper.Side(ResultSide.HOME, homeName, match.homeTeamId()),
                    new ImportTeamMapper.Side(ResultSide.AWAY, awayName, match.awayTeamId()));
            League league = match.leagueId() == null ? null : leagues.get(match.leagueId());
            Set<ImportMatchReason> reasons = EnumSet.noneOf(ImportMatchReason.class);
            if (imported.isPresent() && imported.get().matchId().equals(match.id())) {
                reasons.add(ImportMatchReason.EXTERNAL_ID);
            }
            if (match.id().equals(given)) {
                reasons.add(ImportMatchReason.GIVEN);
            }
            if (date != null && date.equals(match.matchDate().atZone(ZoneId.systemDefault()).toLocalDate())) {
                reasons.add(ImportMatchReason.DATE);
            }
            if (ImportTeamMapper.bothPlaced(mapping)) {
                reasons.add(ImportMatchReason.TEAMS);
            }
            if (fileMatch != null && similarText(fileMatch.venue(), match.venue())) {
                reasons.add(ImportMatchReason.VENUE);
            }
            if (fileMatch != null && league != null && similarText(fileMatch.competition(), league.getName())) {
                reasons.add(ImportMatchReason.COMPETITION);
            }
            located.add(new Located(
                    new MatchCandidateDto(
                            match.id(), homeName + " v " + awayName, match.matchDate(), homeName, awayName,
                            match.homeTeamId() != null, match.awayTeamId() != null,
                            league == null ? null : league.getName(), match.venue(),
                            reasons.stream().sorted().toList(), existing.get(match.id()),
                            match.deletable()), // docs/specs/109: batched by MatchService.listMatching
                    mapping));
        }
        located.sort(Comparator
                .comparingInt((Located l) -> -score(l.candidate().reasons()))
                .thenComparing(l -> l.candidate().matchDate()));
        return located;
    }

    /** How firmly the evidence ties the file to this match: identity is EXACT, other evidence NORMALISED, none UNRESOLVED. */
    public static ImportExactness exactnessOf(List<ImportMatchReason> reasons) {
        if (reasons.contains(ImportMatchReason.EXTERNAL_ID) || reasons.contains(ImportMatchReason.GIVEN)) {
            return ImportExactness.EXACT;
        }
        return reasons.isEmpty() ? ImportExactness.UNRESOLVED : ImportExactness.NORMALISED;
    }

    private static int score(List<ImportMatchReason> reasons) {
        Map<ImportMatchReason, Integer> weight = new HashMap<>();
        weight.put(ImportMatchReason.EXTERNAL_ID, 100);
        weight.put(ImportMatchReason.GIVEN, 50);
        weight.put(ImportMatchReason.TEAMS, 30);
        weight.put(ImportMatchReason.DATE, 20);
        weight.put(ImportMatchReason.VENUE, 5);
        weight.put(ImportMatchReason.COMPETITION, 5);
        return reasons.stream().mapToInt(weight::get).sum();
    }

    private static String sideName(UUID teamId, String freeText, Map<UUID, Team> teams) {
        Team team = teamId == null ? null : teams.get(teamId);
        return team != null ? team.getName() : freeText;
    }

    /** Equal after the shared canonical form, or one contains the other (at least a few characters). */
    private static boolean similarText(String fromFile, String stored) {
        String a = PlayerNameMatcher.canonical(fromFile);
        String b = PlayerNameMatcher.canonical(stored);
        if (a.length() < MIN_TEXT_MATCH || b.length() < MIN_TEXT_MATCH) {
            return false;
        }
        return a.equals(b) || a.contains(b) || b.contains(a);
    }
}
