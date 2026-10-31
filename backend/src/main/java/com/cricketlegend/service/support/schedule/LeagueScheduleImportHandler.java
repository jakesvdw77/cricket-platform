package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.ImportBatch;
import com.cricketlegend.domain.ImportBatchEntity;
import com.cricketlegend.domain.ImportEntityAction;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportResolutionKind;
import com.cricketlegend.domain.ImportRowAction;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportTemplateScope;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CopyLeagueTeamsRequest;
import com.cricketlegend.dto.CopyLeagueTeamsResponse;
import com.cricketlegend.dto.CreateLeagueTeamRequest;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.DeletionBlockerDto;
import com.cricketlegend.dto.DeletionCheckDto;
import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportDecisionsDto.Resolution;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.ImportTypeDto;
import com.cricketlegend.dto.LeagueTeamDto;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.PlannedChangeDto;
import com.cricketlegend.dto.ReferenceProposalDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.exception.DuplicateLeagueTeamNameException;
import com.cricketlegend.exception.ImportDeletionBlockedException;
import com.cricketlegend.exception.MatchNotEmptyException;
import com.cricketlegend.config.AccessService;
import com.cricketlegend.dto.LeagueSeasonDatesDto;
import com.cricketlegend.dto.UpdateLeagueSeasonDatesRequest;
import com.cricketlegend.repository.MatchRepository.OutsideDatesSummary;
import com.cricketlegend.service.LeagueSeasonDatesService;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ImportBatchEntityRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.LeagueTeamRepository.ReferencedMatchCount;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.LeagueTeamService;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.support.CommitOutcome;
import com.cricketlegend.service.support.CommitOutcome.Committed;
import com.cricketlegend.service.support.CommitOutcome.RememberedAlias;
import com.cricketlegend.service.support.EffectiveImport;
import com.cricketlegend.service.support.ExistingMatches;
import com.cricketlegend.service.support.ImportFile;
import com.cricketlegend.service.support.ImportOptions;
import com.cricketlegend.service.support.ImportScope;
import com.cricketlegend.service.support.ImportTypeHandler;
import com.cricketlegend.service.support.ParsedImport;
import com.cricketlegend.service.support.ResolvedRow;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.service.support.TemplateFormat;
import com.cricketlegend.service.support.ValidationResult;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Context;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.DateRange;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.RowResult;
import com.cricketlegend.service.support.schedule.ScheduleWorldLoader.Existing;
import com.cricketlegend.service.support.schedule.ScheduleWorldLoader.Teams;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.TeamProposal;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * The league schedule import type (docs/specs/098-league-schedule-import.md): the first consumer of the import
 * framework. Pure rules live in {@link LeagueScheduleValidator}, {@link LeagueScheduleIdentity} and
 * {@link TeamNameMatcher}; this class maps entities onto them, orders the commit and guards the delete. Writes go only
 * through {@link LeagueTeamService} and {@link MatchService}, so every rule of the normal create path applies; it never
 * writes {@code import_alias} or {@code import_batch_entity} (it returns a {@link CommitOutcome}) and never touches the
 * result tables (it goes through {@link ScheduleDeletionBlockers} over {@code MatchEmptiness}). Row values, names and
 * cells are never logged.
 */
@Component
public class LeagueScheduleImportHandler implements ImportTypeHandler {

    static final String LEAGUE_TEAM = "LEAGUE_TEAM";
    static final String MATCH = "MATCH";
    static final String LEAGUE_SEASON = "LEAGUE_SEASON";
    static final String TARGET_OWN = "OWN_TEAM";
    static final String TARGET_LEAGUE = "LEAGUE_TEAM";
    static final String TARGET_COPY = "COPY_LEAGUE_TEAM";
    private static final int PROMPT_LIST_CAP = 150;

    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final ScheduleWorldLoader loader;
    private final TeamNameMatcher matcher;
    private final ScheduleDeletionBlockers blockers;
    private final MatchService matchService;
    private final LeagueTeamService leagueTeamService;
    private final MatchRepository matchRepository;
    private final LeagueTeamRepository leagueTeamRepository;
    private final TeamRepository teamRepository;
    private final ImportBatchEntityRepository batchEntityRepository;
    private final LeagueSeasonDatesService leagueSeasonDatesService;
    private final AccessService accessService;

    public LeagueScheduleImportHandler(
            ScheduleWorldLoader loader,
            TeamNameMatcher matcher,
            ScheduleDeletionBlockers blockers,
            MatchService matchService,
            LeagueTeamService leagueTeamService,
            MatchRepository matchRepository,
            LeagueTeamRepository leagueTeamRepository,
            TeamRepository teamRepository,
            ImportBatchEntityRepository batchEntityRepository,
            LeagueSeasonDatesService leagueSeasonDatesService,
            AccessService accessService) {
        this.loader = loader;
        this.matcher = matcher;
        this.blockers = blockers;
        this.matchService = matchService;
        this.leagueTeamService = leagueTeamService;
        this.matchRepository = matchRepository;
        this.leagueTeamRepository = leagueTeamRepository;
        this.teamRepository = teamRepository;
        this.batchEntityRepository = batchEntityRepository;
        this.leagueSeasonDatesService = leagueSeasonDatesService;
        this.accessService = accessService;
    }

    // ---- identity of the type ----------------------------------------------------------------------------------

    @Override
    public String type() {
        return ScheduleFileReader.TYPE;
    }

    @Override
    public String label() {
        return "League schedule";
    }

    @Override
    public List<ImportTypeDto.EditableColumn> editableColumns() {
        return List.of(
                new ImportTypeDto.EditableColumn(ScheduleFileReader.K_DATE, "Date", ImportTypeDto.Kind.DATE),
                new ImportTypeDto.EditableColumn(ScheduleFileReader.K_TIME, "Start time", ImportTypeDto.Kind.TIME),
                new ImportTypeDto.EditableColumn(ScheduleFileReader.K_HOME, "Home team", ImportTypeDto.Kind.TEXT),
                new ImportTypeDto.EditableColumn(ScheduleFileReader.K_AWAY, "Away team", ImportTypeDto.Kind.TEXT),
                new ImportTypeDto.EditableColumn(ScheduleFileReader.K_VENUE, "Venue", ImportTypeDto.Kind.TEXT),
                new ImportTypeDto.EditableColumn(ScheduleFileReader.K_NOTES, "Notes", ImportTypeDto.Kind.TEXT));
    }

    @Override
    public int templateVersion() {
        return ScheduleFileReader.TEMPLATE_VERSION;
    }

    @Override
    public boolean supportsOursScope() {
        return true;
    }

    @Override
    public String scopeKey(ImportScope scope) {
        UUID leagueId = requireId(scope, "leagueId");
        UUID seasonId = requireId(scope, "seasonId");
        loader.assertScope(scope.clubId(), leagueId, seasonId);
        return "league:" + leagueId + "|season:" + seasonId;
    }

    private static UUID requireId(ImportScope scope, String name) {
        String value = scope.param(name);
        if (value == null || value.isBlank()) {
            throw new ValidationException(name + " is required");
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new ValidationException(name + " is not valid");
        }
    }

    // ---- template and AI help ----------------------------------------------------------------------------------

    @Override
    public byte[] buildTemplate(ImportScope scope, ImportTemplateScope templateScope, TemplateFormat format) {
        if (format == TemplateFormat.CSV) {
            return ScheduleTemplateWriter.build(emptyTemplateData(scope, templateScope), format);
        }
        Teams teams = loader.loadTeams(scope.clubId(), requireId(scope, "leagueId"), requireId(scope, "seasonId"));
        List<String> ours = ownTeamNames(teams);
        boolean others = templateScope == ImportTemplateScope.OURS_AND_OTHERS;
        List<String> thisSeason = others
                ? teams.thisSeason().stream().filter(LeagueTeam::isActive).map(LeagueTeam::getName).toList()
                : List.of();
        List<ScheduleTemplateWriter.Named> previous = others
                ? teams.previous().stream()
                        .filter(t -> t.getLeagueId().equals(teams.league().getId()))
                        .map(t -> new ScheduleTemplateWriter.Named(t.getName(), teams.seasonLabels().get(t.getSeasonId())))
                        .toList()
                : List.of();
        return ScheduleTemplateWriter.build(new ScheduleTemplateWriter.Data(
                scope.clubId().toString(), teams.league().getId().toString(), teams.season().getId().toString(),
                teams.league().getName(), teams.season().getLabel(), templateScope == null ? ImportTemplateScope.OURS_AND_OTHERS : templateScope,
                ours, thisSeason, previous, loader.venues(scope.clubId())), format);
    }

    private ScheduleTemplateWriter.Data emptyTemplateData(ImportScope scope, ImportTemplateScope templateScope) {
        return new ScheduleTemplateWriter.Data(scope.clubId().toString(), "", "", "", "",
                templateScope == null ? ImportTemplateScope.OURS_AND_OTHERS : templateScope,
                List.of(), List.of(), List.of(), List.of());
    }

    /** The club's active teams affiliated to this league and season, or all its active teams when none is. */
    private static List<String> ownTeamNames(Teams teams) {
        List<Team> active = teams.ownTeams().values().stream().filter(Team::isActive).toList();
        List<Team> chosen = active.stream().filter(t -> teams.affiliated().contains(t.getId())).toList();
        if (chosen.isEmpty()) {
            chosen = active;
        }
        return chosen.stream().map(Team::getName).sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    @Override
    public String aiPrompt(ImportScope scope) {
        Teams teams = loader.loadTeams(scope.clubId(), requireId(scope, "leagueId"), requireId(scope, "seasonId"));
        StringBuilder out = new StringBuilder();
        if (teams.season().getStartDate() != null && teams.season().getEndDate() != null) {
            out.append("The season runs from ").append(teams.season().getStartDate()).append(" to ")
                    .append(teams.season().getEndDate()).append(".\n\n");
        }
        out.append("Names the system already knows for this league (use them only to check your reading, "
                + "do not rewrite names):\n");
        out.append("Our teams: ").append(joinCapped(ownTeamNames(teams))).append('\n');
        if (scope.templateScope() != ImportTemplateScope.OURS_ONLY) {
            Set<String> names = new LinkedHashSet<>();
            teams.thisSeason().forEach(t -> names.add(t.getName()));
            teams.previous().stream().filter(t -> t.getLeagueId().equals(teams.league().getId()))
                    .forEach(t -> names.add(t.getName()));
            out.append("League teams: ").append(joinCapped(names)).append('\n');
        }
        out.append("Known venues: ").append(joinCapped(loader.venues(scope.clubId()))).append('\n');
        return out.toString();
    }

    private static String joinCapped(Collection<String> names) {
        List<String> list = names.stream().limit(PROMPT_LIST_CAP).toList();
        return list.isEmpty() ? "(none)" : String.join(", ", list);
    }

    // ---- parse -------------------------------------------------------------------------------------------------

    @Override
    public ParsedImport parse(ImportFile file, ImportScope scope, ImportOptions options) {
        ParsedImport parsed = ScheduleFileReader.read(file, scope);
        Map<String, String> meta = new LinkedHashMap<>(parsed.meta());
        meta.put("timeZone", options.zone().getId());
        return new ParsedImport(parsed.rows(), parsed.fileWarnings(), meta);
    }

    // ---- validate ----------------------------------------------------------------------------------------------

    @Override
    public ValidationResult validate(ParsedImport parsed, ImportScope scope, ImportDecisionsDto decisions) {
        Eval eval = evaluate(parsed.rows(), parsed.meta(), scope, decisions, zoneOf(parsed.meta().get("timeZone")));
        return new ValidationResult(eval.rows(), eval.result().issues());
    }

    private static ZoneId zoneOf(String id) {
        if (id == null || id.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(id);
        } catch (DateTimeException ex) {
            return ZoneId.systemDefault();
        }
    }

    /** Everything one validation pass produced, shared by validate, the planned changes and the commit. */
    private record Eval(
            Teams teams,
            ZoneId zone,
            List<LeagueScheduleValidator.Row> inputs,
            LeagueScheduleValidator.Result result,
            List<ImportRowDto> rows,
            Map<Integer, RowResult> byRow,
            Map<UUID, ExistingMatch> existingById,
            SideResolver sides,
            DateRange leagueOriginal,
            DateRange leagueWidened) {
    }

    private static boolean extendLeagueDates(ImportDecisionsDto decisions) {
        Object raw = decisions.options().get("extendLeagueDates");
        return Boolean.TRUE.equals(raw) || (raw != null && "true".equalsIgnoreCase(raw.toString().trim()));
    }

    /** The league range widened to cover the dates; null when it would not change (never narrows). */
    private static DateRange widen(DateRange range, LocalDate min, LocalDate max) {
        if (range == null || range.start() == null || range.end() == null || min == null) {
            return null;
        }
        LocalDate start = min.isBefore(range.start()) ? min : range.start();
        LocalDate end = max.isAfter(range.end()) ? max : range.end();
        return start.equals(range.start()) && end.equals(range.end()) ? null : new DateRange(start, end);
    }

    private Eval evaluate(
            List<ImportRowDto> rows,
            Map<String, String> meta,
            ImportScope scope,
            ImportDecisionsDto decisions,
            ZoneId zone) {
        UUID leagueId = requireId(scope, "leagueId");
        UUID seasonId = requireId(scope, "seasonId");
        Teams teams = loader.loadTeams(scope.clubId(), leagueId, seasonId);
        ImportScopeMode mode = scope.scopeMode() == null ? ImportScopeMode.ALL : scope.scopeMode();
        SideResolver sides = new SideResolver(teams, decisions);
        Set<Integer> excludedRows = new HashSet<>(decisions.excludedRows());

        List<LeagueScheduleValidator.Row> inputs = new ArrayList<>(rows.size());
        ScheduleDateParser.YearContext yearContext = new ScheduleDateParser.YearContext(
                teams.season().getStartDate(), teams.season().getEndDate());
        LocalDate min = null;
        LocalDate max = null;
        for (ImportRowDto row : rows) {
            String homeName = text(row, ScheduleFileReader.K_HOME);
            String awayName = text(row, ScheduleFileReader.K_AWAY);
            ScheduleDateParser.Result date = ScheduleDateParser.parseText(text(row, ScheduleFileReader.K_DATE), yearContext);
            ScheduleTimeParser.Result time = ScheduleTimeParser.parseText(text(row, ScheduleFileReader.K_TIME));
            ResolvedSide home = homeName.isEmpty() ? null : sides.resolve(homeName);
            ResolvedSide away = awayName.isEmpty() ? null : sides.resolve(awayName);
            boolean excluded = excludedRows.contains(row.rowNumber()) || sides.skips(homeName) || sides.skips(awayName);
            inputs.add(new LeagueScheduleValidator.Row(row.rowNumber(), row.sourceRef(), date, time, homeName,
                    awayName, text(row, ScheduleFileReader.K_VENUE), home, away, excluded));
            if (!excluded && date.ok()) {
                min = min == null || date.date().isBefore(min) ? date.date() : min;
                max = max == null || date.date().isAfter(max) ? date.date() : max;
            }
        }
        Existing existing = loader.loadExisting(teams, min, max, zone);
        DateRange leagueOriginal = teams.leagueSeason() == null ? null
                : new DateRange(teams.leagueSeason().getStartDate(), teams.leagueSeason().getEndDate());
        DateRange leagueWidened = null;
        if (leagueOriginal != null && extendLeagueDates(decisions)) {
            // First pass with the real range: the rows it flags as outside (and that would be written) set the new range.
            Context first = context(mode, zone, leagueId, seasonId, teams, leagueOriginal, scope, decisions, existing, meta);
            LocalDate lo = null;
            LocalDate hi = null;
            Map<Integer, LeagueScheduleValidator.Row> inputByRow = new HashMap<>();
            inputs.forEach(i -> inputByRow.put(i.rowNumber(), i));
            for (RowResult r : LeagueScheduleValidator.validate(inputs, first).rows()) {
                var in = inputByRow.get(r.rowNumber());
                if (in != null && in.date() != null && in.date().ok()
                        && r.issueCodes().contains(ScheduleRule.DATE_OUTSIDE_LEAGUE_DATES.name())
                        && widensLeagueDates(r)) {
                    LocalDate d = in.date().date();
                    lo = lo == null || d.isBefore(lo) ? d : lo;
                    hi = hi == null || d.isAfter(hi) ? d : hi;
                }
            }
            leagueWidened = widen(leagueOriginal, lo, hi);
        }
        Context ctx = context(mode, zone, leagueId, seasonId, teams,
                leagueWidened == null ? leagueOriginal : leagueWidened, scope, decisions, existing, meta);
        LeagueScheduleValidator.Result result = LeagueScheduleValidator.validate(inputs, ctx);
        return finish(rows, teams, zone, inputs, result, existing, sides, leagueOriginal, leagueWidened);
    }

    /**
     * A row with a date outside the league dates widens them unless the user excluded it or it is skipped as a
     * duplicate or identical row. Rows still being fixed (unresolved teams, other errors) count: the date does not
     * depend on them, and waiting for them to become CREATE would leave the error in place for good.
     */
    private static boolean widensLeagueDates(RowResult r) {
        if (r.action() == ImportRowAction.EXCLUDED) {
            return false;
        }
        return r.action() != ImportRowAction.SKIP || r.outcome() == ImportOutcome.DIFFERS;
    }

    private Context context(ImportScopeMode mode, ZoneId zone, UUID leagueId, UUID seasonId, Teams teams,
            DateRange leagueRange, ImportScope scope, ImportDecisionsDto decisions, Existing existing, Map<String, String> meta) {
        return new Context(
                mode, zone, leagueId, seasonId, teams.season().getLabel(),
                new DateRange(teams.season().getStartDate(), teams.season().getEndDate()),
                leagueRange,
                windowDays(scope, decisions), existing.matches(), existing.venues(),
                decisions.updates().stream().map(ImportDecisionsDto.RowUpdate::rowNumber).collect(java.util.stream.Collectors.toSet()),
                decisions.updateAllDiffering(),
                teams.league().isActive() ? null : "This league is inactive. Activate it before importing a schedule.",
                templateMadeFor(meta, teams), null);
    }

    private Eval finish(List<ImportRowDto> rows, Teams teams, ZoneId zone, List<LeagueScheduleValidator.Row> inputs,
            LeagueScheduleValidator.Result result, Existing existing, SideResolver sides, DateRange leagueOriginal,
            DateRange leagueWidened) {

        Map<Integer, RowResult> byRow = new HashMap<>();
        result.rows().forEach(r -> byRow.put(r.rowNumber(), r));
        List<ImportRowDto> out = new ArrayList<>(rows.size());
        for (ImportRowDto row : rows) {
            RowResult r = byRow.get(row.rowNumber());
            out.add(r == null ? row : row.withResult(r.status(), r.outcome(), r.action(), r.issueCodes(), r.existingRef()));
        }
        Map<UUID, ExistingMatch> existingById = new HashMap<>();
        existing.matches().forEach(m -> existingById.put(m.id(), m));
        return new Eval(teams, zone, inputs, result, out, byRow, existingById, sides, leagueOriginal, leagueWidened);
    }

    /** Decisions option first (Check rows step), then the legacy scope param, then the default; clamped 1..60. */
    private static int windowDays(ImportScope scope, ImportDecisionsDto decisions) {
        Integer fromOptions = toInt(decisions.options().get("windowDays"));
        if (fromOptions != null) {
            return clampWindow(fromOptions);
        }
        Integer fromScope = toInt(scope.param("windowDays"));
        return fromScope != null ? clampWindow(fromScope) : ScheduleConstants.DEFAULT_WINDOW_DAYS;
    }

    private static int clampWindow(int days) {
        return Math.max(ScheduleConstants.MIN_WINDOW_DAYS, Math.min(ScheduleConstants.MAX_WINDOW_DAYS, days));
    }

    private static Integer toInt(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            if (raw instanceof Number n) {
                double d = n.doubleValue();
                return Double.isNaN(d) || Double.isInfinite(d) ? null : (int) Math.round(Math.max(-1e6, Math.min(1e6, d)));
            }
            String t = raw.toString().trim();
            if (t.isEmpty()) {
                return null;
            }
            double d = Double.parseDouble(t);
            return Double.isNaN(d) || Double.isInfinite(d) ? null : (int) Math.round(Math.max(-1e6, Math.min(1e6, d)));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String templateMadeFor(Map<String, String> meta, Teams teams) {
        if (!"true".equals(meta.get(ScheduleFileReader.META_SCOPE_MISMATCH))) {
            return null;
        }
        String league = lookup(meta.get("leagueId"), teams.leagueNames());
        String season = lookup(meta.get("seasonId"), teams.seasonLabels());
        return league == null && season == null ? "another league or season"
                : (league == null ? "another league" : league) + ", " + (season == null ? "another season" : season);
    }

    private static String lookup(String id, Map<UUID, String> names) {
        try {
            return id == null ? null : names.get(UUID.fromString(id.trim()));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String text(ImportRowDto row, String key) {
        Object value = row.values().get(key);
        return value == null ? "" : value.toString().trim();
    }

    // ---- side resolution ---------------------------------------------------------------------------------------

    /**
     * Maps each sheet name to what the decisions made of it (docs/specs/098, "The user's choices per name"). A name is
     * ours only when it is linked to one of our teams; identification (a name in {@code identifiedAsOurs}) without an
     * own-team link is unresolved. Names are compared by their normalised form, so the key the client echoes may differ
     * in case or spacing from the sheet text.
     */
    private static final class SideResolver {
        private final Teams teams;
        private final Map<String, Resolution> byName = new LinkedHashMap<>();
        private final Map<String, ResolvedSide> cache = new HashMap<>();
        private final Map<String, Resolution> resolutionByIdentity = new HashMap<>();
        private final Set<String> claimedNames = new HashSet<>();

        SideResolver(Teams teams, ImportDecisionsDto decisions) {
            this.teams = teams;
            for (Resolution r : decisions.resolutions()) {
                if (r.key() != null) {
                    byName.put(TeamNameMatcher.normalise(r.key()), r);
                }
            }
        }

        boolean skips(String name) {
            if (name == null || name.isEmpty()) {
                return false;
            }
            Resolution r = byName.get(TeamNameMatcher.normalise(name));
            return r != null && r.kind() == ImportResolutionKind.SKIP_ROWS;
        }

        /** The resolved side, or null while the name is not linked or created. */
        ResolvedSide resolve(String name) {
            String key = TeamNameMatcher.normalise(name);
            if (cache.containsKey(key)) {
                return cache.get(key);
            }
            ResolvedSide side = build(name, byName.get(key));
            cache.put(key, side);
            if (side != null && (side.kind() == ResolvedSide.Kind.NEW_LEAGUE_TEAM
                    || side.kind() == ResolvedSide.Kind.COPIED_LEAGUE_TEAM)) {
                resolutionByIdentity.putIfAbsent(side.identity(), byName.get(key));
            }
            return side;
        }

        Resolution resolutionOf(ResolvedSide side) {
            return resolutionByIdentity.get(side.identity());
        }

        Collection<Resolution> all() {
            return byName.values();
        }

        ResolvedSide cached(String sheetName) {
            return cache.get(TeamNameMatcher.normalise(sheetName));
        }

        private ResolvedSide build(String sheetName, Resolution r) {
            if (r == null || r.kind() == null || r.kind() == ImportResolutionKind.SKIP_ROWS) {
                return null;
            }
            Set<String> known = Set.of(sheetName);
            if (r.kind() == ImportResolutionKind.CREATE) {
                String name = r.targetName() == null || r.targetName().isBlank()
                        ? TeamNameMatcher.tidyTeamName(sheetName)
                        : r.targetName().trim().replaceAll("\\s+", " ");
                return ResolvedSide.toCreate(name, collision(name));
            }
            if (TARGET_OWN.equals(r.targetKind())) {
                Team team = r.targetId() == null ? null : teams.ownTeams().get(r.targetId());
                return team == null ? null
                        : ResolvedSide.ownTeam(team.getId(), team.getName(), teams.affiliated().contains(team.getId()), known);
            }
            if (r.targetId() == null) {
                return null;
            }
            if (TARGET_LEAGUE.equals(r.targetKind())) {
                LeagueTeam team = teams.thisSeasonTeam(r.targetId());
                return team == null ? null : ResolvedSide.leagueTeam(team.getId(), team.getName(), team.isActive(), known);
            }
            if (TARGET_COPY.equals(r.targetKind())) {
                LeagueTeam source = teams.sourceTeam(r.targetId());
                return source == null ? null : ResolvedSide.toCopy(source.getId(), source.getName(), collision(source.getName()));
            }
            return null;
        }

        /** A clash with a league team of this league and season (inactive included) or one already claimed here. */
        private ResolvedSide.Collision collision(String name) {
            String key = ScheduleWorldLoader.key(name);
            for (LeagueTeam existing : teams.thisSeason()) {
                if (ScheduleWorldLoader.key(existing.getName()).equals(key)) {
                    return new ResolvedSide.Collision(existing.getName(), !existing.isActive());
                }
            }
            if (!claimedNames.add(key)) {
                return new ResolvedSide.Collision(name, false);
            }
            return null;
        }
    }

    // ---- propose -----------------------------------------------------------------------------------------------

    @Override
    public List<ReferenceProposalDto> propose(ParsedImport parsed, ImportScope scope) {
        Teams teams = loader.loadTeams(scope.clubId(), requireId(scope, "leagueId"), requireId(scope, "seasonId"));
        Map<String, String> display = new LinkedHashMap<>();
        Map<String, List<Integer>> rowsByName = new LinkedHashMap<>();
        for (ImportRowDto row : parsed.rows()) {
            for (String name : new String[] {text(row, ScheduleFileReader.K_HOME), text(row, ScheduleFileReader.K_AWAY)}) {
                if (name.isEmpty()) {
                    continue;
                }
                String key = TeamNameMatcher.normalise(name);
                display.putIfAbsent(key, name);
                List<Integer> numbers = rowsByName.computeIfAbsent(key, k -> new ArrayList<>());
                if (numbers.isEmpty() || numbers.get(numbers.size() - 1) != row.rowNumber()) {
                    numbers.add(row.rowNumber());
                }
            }
        }
        List<String> names = new ArrayList<>(display.values());
        List<ReferenceProposalDto> out = new ArrayList<>();
        if (scope.scopeMode() == ImportScopeMode.OURS_ONLY) {
            Map<String, List<TeamProposal>> identify =
                    matcher.proposeAll(names, loader.candidates(teams, true), loader.aliases(teams, true));
            addProposals(out, "IDENTIFY_OURS", names, display, rowsByName, identify, teams);
        }
        Map<String, List<TeamProposal>> resolve =
                matcher.proposeAll(names, loader.candidates(teams, false), loader.aliases(teams, false));
        addProposals(out, "RESOLVE", names, display, rowsByName, resolve, teams);
        return out;
    }

    private void addProposals(
            List<ReferenceProposalDto> out,
            String step,
            List<String> names,
            Map<String, String> display,
            Map<String, List<Integer>> rowsByName,
            Map<String, List<TeamProposal>> proposals,
            Teams teams) {
        for (String name : names) {
            String key = TeamNameMatcher.normalise(name);
            List<ReferenceProposalDto.Candidate> candidates = new ArrayList<>();
            for (TeamProposal p : proposals.getOrDefault(name, List.of())) {
                if (!p.linkable()) {
                    continue;
                }
                String targetKind = TARGET_OWN.equals(p.targetKind()) ? TARGET_OWN
                        : teams.thisSeasonTeam(p.targetId()) != null ? TARGET_LEAGUE : TARGET_COPY;
                candidates.add(new ReferenceProposalDto.Candidate(targetKind, p.targetId(), p.targetName(),
                        p.source().name(), p.confidence(), p.reasons(), p.preselected(), p.source().name(),
                        p.seasonLabel(), p.leagueName()));
            }
            out.add(new ReferenceProposalDto(display.get(key), display.get(key), step, rowsByName.get(key), candidates,
                    TeamNameMatcher.tidyTeamName(display.get(key))));
        }
    }

    // ---- identity ----------------------------------------------------------------------------------------------

    /** {@code resolved} carries {@code leagueId}, {@code seasonId}, {@code home} and {@code away} identity strings. */
    @Override
    public Object identityKey(ResolvedRow row) {
        String a = String.valueOf(row.resolved().get("home"));
        String b = String.valueOf(row.resolved().get("away"));
        boolean ordered = a.compareTo(b) <= 0;
        return List.of(String.valueOf(row.resolved().get("leagueId")), String.valueOf(row.resolved().get("seasonId")),
                ordered ? a : b, ordered ? b : a, String.valueOf(row.row().values().get(ScheduleFileReader.K_DATE)));
    }

    /**
     * The existing matches of this league and season by identity, over side ids (a free-text side has no resolvable
     * identity here). The framework's own flow does not call this: the handler's validate finds duplicates itself with
     * the full rules (free-text sides, time, venue).
     */
    @Override
    public ExistingMatches findExisting(ImportScope scope, Collection<Object> keys) {
        UUID leagueId = requireId(scope, "leagueId");
        UUID seasonId = requireId(scope, "seasonId");
        Teams teams = loader.loadTeams(scope.clubId(), leagueId, seasonId);
        Map<Object, ExistingMatches.Record> found = new HashMap<>();
        for (ExistingMatch m : loader.loadExisting(teams, null, null, ZoneId.systemDefault()).matches()) {
            if (m.home().freeText() || m.away().freeText() || !leagueId.equals(m.leagueId()) || !seasonId.equals(m.seasonId())) {
                continue;
            }
            String a = sideIdentity(m.home());
            String b = sideIdentity(m.away());
            boolean ordered = a.compareTo(b) <= 0;
            Object key = List.of(leagueId.toString(), seasonId.toString(), ordered ? a : b, ordered ? b : a,
                    ServerClock.localDate(m.start()).toString());
            if (keys.contains(key)) {
                found.put(key, new ExistingMatches.Record(MATCH, m.id(), m.home().name() + " v " + m.away().name(),
                        Map.of("start", m.start().toString(), "venue", m.venue() == null ? "" : m.venue())));
            }
        }
        return new ExistingMatches(found);
    }

    private static String sideIdentity(ExistingMatch.Side side) {
        return side.teamId() != null ? "T:" + side.teamId() : "L:" + side.leagueTeamId();
    }

    // ---- planned changes and commit ----------------------------------------------------------------------------

    private record TeamPlan(String identity, ResolvedSide side, String abbreviation, int firstRow) {
        boolean copy() {
            return side.kind() == ResolvedSide.Kind.COPIED_LEAGUE_TEAM;
        }
    }

    private record MatchPlan(int rowNumber, RowResult result, ResolvedSide home, ResolvedSide away) {}

    private record UpdatePlan(int rowNumber, UUID matchId, ExistingMatch existing, Instant newStart, String newVenue,
            boolean timeChanges, boolean venueChanges) {}

    private record Plan(List<TeamPlan> teams, List<MatchPlan> creates, List<UpdatePlan> updates) {}

    private Plan plan(Eval eval, ImportDecisionsDto decisions) {
        Map<Integer, LeagueScheduleValidator.Row> input = new HashMap<>();
        eval.inputs().forEach(r -> input.put(r.rowNumber(), r));
        Map<Integer, Set<String>> restriction = new HashMap<>();
        for (ImportDecisionsDto.RowUpdate u : decisions.updates()) {
            restriction.put(u.rowNumber(), u.attributes().isEmpty() ? null
                    : u.attributes().stream().map(a -> a.toUpperCase(Locale.ROOT)).collect(java.util.stream.Collectors.toSet()));
        }
        Map<String, TeamPlan> teams = new LinkedHashMap<>();
        List<MatchPlan> creates = new ArrayList<>();
        List<UpdatePlan> updates = new ArrayList<>();
        List<RowResult> ordered = eval.result().rows().stream().sorted(Comparator.comparingInt(RowResult::rowNumber)).toList();
        for (RowResult r : ordered) {
            LeagueScheduleValidator.Row in = input.get(r.rowNumber());
            if (r.action() == ImportRowAction.CREATE && in != null && in.home() != null && in.away() != null && r.start() != null) {
                creates.add(new MatchPlan(r.rowNumber(), r, in.home(), in.away()));
                for (ResolvedSide side : List.of(in.home(), in.away())) {
                    if (side.kind() == ResolvedSide.Kind.NEW_LEAGUE_TEAM || side.kind() == ResolvedSide.Kind.COPIED_LEAGUE_TEAM) {
                        Resolution res = eval.sides().resolutionOf(side);
                        teams.putIfAbsent(side.identity(), new TeamPlan(side.identity(), side,
                                res == null || res.abbreviation() == null || res.abbreviation().isBlank() ? null
                                        : res.abbreviation().trim(), r.rowNumber()));
                    }
                }
            } else if (r.action() == ImportRowAction.UPDATE && r.existingMatchId() != null) {
                ExistingMatch existing = eval.existingById().get(r.existingMatchId());
                if (existing == null) {
                    continue;
                }
                Set<String> allowed = restriction.get(r.rowNumber());
                boolean all = !restriction.containsKey(r.rowNumber()) || allowed == null;
                boolean time = r.differences().stream().anyMatch(d -> "TIME".equals(d.field())) && (all || allowed.contains("TIME"));
                boolean venue = r.differences().stream().anyMatch(d -> "VENUE".equals(d.field())) && (all || allowed.contains("VENUE"))
                        && r.venue() != null && !r.venue().isBlank();
                if (time || venue) {
                    updates.add(new UpdatePlan(r.rowNumber(), existing.id(), existing, r.start(), r.venue(), time, venue));
                }
            }
        }
        List<TeamPlan> teamList = new ArrayList<>(teams.values());
        teamList.sort(Comparator.comparing(TeamPlan::copy).thenComparingInt(TeamPlan::firstRow));
        return new Plan(teamList, creates, updates);
    }

    @Override
    public List<PlannedChangeDto> plannedChanges(EffectiveImport effective) {
        Eval eval = evaluate(effective.rows(), Map.of(), effective.scope(), effective.decisions(), zoneOf(effective.timeZone()));
        Plan plan = plan(eval, effective.decisions());
        List<PlannedChangeDto> out = new ArrayList<>();
        for (TeamPlan team : plan.teams()) {
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("abbreviation", team.abbreviation() == null ? "" : team.abbreviation());
            if (team.copy()) {
                LeagueTeam source = eval.teams().sourceTeam(team.side().id());
                detail.put("copiedFrom", team.side().id().toString());
                if (source != null) {
                    detail.put("copiedFromSeason", String.valueOf(eval.teams().seasonLabels().get(source.getSeasonId())));
                    detail.put("copiedFromLeague", String.valueOf(eval.teams().leagueNames().get(source.getLeagueId())));
                    if (source.getAbbreviation() != null) {
                        detail.put("abbreviation", source.getAbbreviation());
                    }
                }
            }
            out.add(new PlannedChangeDto(ImportEntityAction.CREATED, LEAGUE_TEAM, team.side().name(), null, detail, Map.of()));
        }
        for (MatchPlan m : plan.creates()) {
            ZonedLabel label = label(m.result().start(), eval.zone());
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("date", label.date());
            detail.put("time", label.time());
            detail.put("venue", m.result().venue() == null ? "" : m.result().venue());
            detail.put("home", m.home().name());
            detail.put("away", m.away().name());
            out.add(new PlannedChangeDto(ImportEntityAction.CREATED, MATCH,
                    label.full() + ", " + m.home().name() + " v " + m.away().name(), m.rowNumber(), detail, Map.of()));
        }
        for (UpdatePlan u : plan.updates()) {
            Map<String, Object> changes = new LinkedHashMap<>();
            if (u.timeChanges()) {
                changes.put("time", Map.of("old", label(u.existing().start(), eval.zone()).full(),
                        "new", label(u.newStart(), eval.zone()).full()));
            }
            if (u.venueChanges()) {
                changes.put("venue", Map.of("old", u.existing().venue() == null ? "" : u.existing().venue(),
                        "new", u.newVenue()));
            }
            out.add(new PlannedChangeDto(ImportEntityAction.UPDATED, MATCH,
                    label(u.existing().start(), eval.zone()).full() + ", " + u.existing().home().name() + " v "
                            + u.existing().away().name(),
                    u.rowNumber(), Map.of("matchId", u.matchId().toString()), changes));
        }
        if (eval.leagueWidened() != null) {
            Map<String, Object> changes = new LinkedHashMap<>();
            changes.put("start", Map.of("old", eval.leagueOriginal().start().toString(), "new", eval.leagueWidened().start().toString()));
            changes.put("end", Map.of("old", eval.leagueOriginal().end().toString(), "new", eval.leagueWidened().end().toString()));
            out.add(new PlannedChangeDto(ImportEntityAction.UPDATED, LEAGUE_SEASON, "League dates", null, Map.of(), changes));
        }
        return out;
    }

    private record ZonedLabel(String date, String time, String full) {}

    private static ZonedLabel label(Instant instant, ZoneId zone) {
        var local = instant.atZone(zone);
        return new ZonedLabel(local.toLocalDate().toString(), String.format("%02d:%02d", local.getHour(), local.getMinute()),
                LABEL.format(local));
    }

    @Override
    public CommitOutcome commit(Authentication auth, EffectiveImport effective) {
        ImportScope scope = effective.scope();
        UUID clubId = scope.clubId();
        UUID leagueId = requireId(scope, "leagueId");
        UUID seasonId = requireId(scope, "seasonId");
        Eval eval = evaluate(effective.rows(), Map.of(), scope, effective.decisions(), zoneOf(effective.timeZone()));
        Plan plan = plan(eval, effective.decisions());
        List<Committed> entities = new ArrayList<>();
        Map<Integer, ImportRowOrigin> origins = new HashMap<>();
        for (ImportRowDto row : effective.rows()) {
            origins.put(row.rowNumber(), row.origin() == null ? ImportRowOrigin.FILE : row.origin());
        }

        // 1. league teams: new ones, then copies
        Map<String, UUID> teamIds = new HashMap<>();
        List<TeamPlan> fresh = plan.teams().stream().filter(t -> !t.copy()).toList();
        if (!fresh.isEmpty()) {
            List<LeagueTeamDto> created = leagueTeamService.createAll(clubId, leagueId, seasonId, fresh.stream()
                    .map(t -> new CreateLeagueTeamRequest(t.side().name(), t.abbreviation(), null)).toList());
            for (int i = 0; i < fresh.size(); i++) {
                teamIds.put(fresh.get(i).identity(), created.get(i).id());
                entities.add(teamEntity(created.get(i), null));
            }
        }
        Map<String, List<TeamPlan>> bySource = new LinkedHashMap<>();
        for (TeamPlan t : plan.teams()) {
            if (t.copy()) {
                LeagueTeam source = eval.teams().sourceTeam(t.side().id());
                bySource.computeIfAbsent(source.getLeagueId() + "|" + source.getSeasonId(), k -> new ArrayList<>()).add(t);
            }
        }
        for (List<TeamPlan> group : bySource.values()) {
            LeagueTeam first = eval.teams().sourceTeam(group.get(0).side().id());
            CopyLeagueTeamsResponse response = leagueTeamService.copy(clubId, leagueId, seasonId, new CopyLeagueTeamsRequest(
                    first.getLeagueId(), first.getSeasonId(), group.stream().map(t -> t.side().id()).toList()));
            if (!response.skipped().isEmpty()) {
                throw new DuplicateLeagueTeamNameException("A league team to be copied already exists in this league and season.");
            }
            Map<String, LeagueTeamDto> byName = new HashMap<>();
            response.created().forEach(c -> byName.put(ScheduleWorldLoader.key(c.name()), c));
            for (TeamPlan t : group) {
                LeagueTeamDto created = byName.get(ScheduleWorldLoader.key(t.side().name()));
                teamIds.put(t.identity(), created.id());
                entities.add(teamEntity(created, t.side().id()));
            }
        }

        // 1b. the league dates, widened before any match is created (never narrowed)
        if (eval.leagueWidened() != null) {
            LeagueSeasonDatesDto live = leagueSeasonDatesService.get(clubId, leagueId, seasonId);
            // the same range the preview computed, so the confirmed result matches what was shown
            LocalDate lo = eval.leagueWidened().start();
            LocalDate hi = eval.leagueWidened().end();
            DateRange target = widen(new DateRange(live.startDate(), live.endDate()), lo, hi);
            if (target != null) {
                leagueSeasonDatesService.update(clubId, leagueId, seasonId,
                        new UpdateLeagueSeasonDatesRequest(target.start(), target.end()),
                        accessService.resolveCurrentPersonId(auth));
                Map<String, Object> previous = new LinkedHashMap<>();
                previous.put("start", live.startDate().toString());
                previous.put("end", live.endDate().toString());
                Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("start", target.start().toString());
                detail.put("end", target.end().toString());
                detail.put("extendedBy", "batch");
                detail.put("seasonId", seasonId.toString());
                entities.add(new Committed(LEAGUE_SEASON, leagueId, ImportEntityAction.UPDATED, null, previous, detail));
            }
        }

        // 2. matches, in one batch
        List<CreateMatchRequest> requests = new ArrayList<>(plan.creates().size());
        for (MatchPlan m : plan.creates()) {
            requests.add(matchRequest(m, leagueId, seasonId, teamIds));
        }
        List<MatchDto> matches = requests.isEmpty() ? List.of() : matchService.createBatch(auth, clubId, requests);
        for (int i = 0; i < matches.size(); i++) {
            MatchPlan m = plan.creates().get(i);
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("start", m.result().start().toString());
            detail.put("venue", m.result().venue() == null ? "" : m.result().venue());
            detail.put("rowOrigin", String.valueOf(origins.getOrDefault(m.rowNumber(), ImportRowOrigin.FILE)));
            entities.add(new Committed(MATCH, matches.get(i).id(), ImportEntityAction.CREATED, m.rowNumber(), null, detail));
        }

        // 3. opted-in updates (time and venue only)
        for (UpdatePlan u : plan.updates()) {
            MatchDto current = matchService.get(auth, clubId, u.matchId());
            Instant start = u.timeChanges() ? u.newStart() : current.matchDate();
            String venue = u.venueChanges() ? u.newVenue() : current.venue();
            matchService.update(auth, clubId, u.matchId(), updateRequest(current, start, venue, u.venueChanges()));
            Map<String, Object> previous = new LinkedHashMap<>();
            previous.put("start", current.matchDate().toString());
            previous.put("venue", current.venue() == null ? "" : current.venue());
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("start", start.toString());
            detail.put("venue", venue == null ? "" : venue);
            entities.add(new Committed(MATCH, u.matchId(), ImportEntityAction.UPDATED, u.rowNumber(), previous, detail));
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("matchesCreated", matches.size());
        summary.put("leagueTeamsCreated", fresh.size());
        summary.put("leagueTeamsCopied", plan.teams().size() - fresh.size());
        summary.put("matchesUpdated", plan.updates().size());
        return new CommitOutcome(entities, aliases(eval, effective.decisions(), leagueId), summary);
    }

    private static Committed teamEntity(LeagueTeamDto team, UUID copiedFrom) {
        Map<String, Object> detail = new LinkedHashMap<>();
        if (copiedFrom != null) {
            detail.put("copiedFrom", copiedFrom.toString());
        }
        detail.put("name", team.name());
        detail.put("abbreviation", team.abbreviation() == null ? "" : team.abbreviation());
        detail.put("logoUrl", team.logoUrl() == null ? "" : team.logoUrl());
        return new Committed(LEAGUE_TEAM, team.id(), ImportEntityAction.CREATED, null, null, detail);
    }

    private static CreateMatchRequest matchRequest(MatchPlan m, UUID leagueId, UUID seasonId, Map<String, UUID> teamIds) {
        UUID homeTeam = m.home().ours() ? m.home().id() : null;
        UUID awayTeam = m.away().ours() ? m.away().id() : null;
        UUID homeLeagueTeam = m.home().ours() ? null : leagueTeamId(m.home(), teamIds);
        UUID awayLeagueTeam = m.away().ours() ? null : leagueTeamId(m.away(), teamIds);
        String venue = m.result().venue() == null || m.result().venue().isBlank() ? null : m.result().venue();
        return new CreateMatchRequest(homeTeam, null, awayTeam, null, null, null, leagueId, seasonId,
                m.result().start(), venue, homeLeagueTeam, awayLeagueTeam, null, null, null);
    }

    private static UUID leagueTeamId(ResolvedSide side, Map<String, UUID> teamIds) {
        return side.kind() == ResolvedSide.Kind.LEAGUE_TEAM ? side.id() : teamIds.get(side.identity());
    }

    /** The existing values for every field but the ones the import changes. */
    private static UpdateMatchRequest updateRequest(MatchDto m, Instant start, String venue, boolean venueChanged) {
        return new UpdateMatchRequest(m.homeTeamId(), m.homeLeagueTeamId() == null ? m.homeTeamName() : null,
                m.awayTeamId(), m.awayLeagueTeamId() == null ? m.awayTeamName() : null,
                m.homeLeagueTeamId() == null ? m.homeTeamLogoUrl() : null,
                m.awayLeagueTeamId() == null ? m.awayTeamLogoUrl() : null,
                m.leagueId(), m.seasonId(), start, venue, m.homeLeagueTeamId(), m.awayLeagueTeamId(),
                m.scoringUrl(), m.streamingUrl(), venueChanged ? null : m.playingAreaId());
    }

    /** One alias per ticked Remember, to the own team, or to the league team's name (it works next season too). */
    private List<RememberedAlias> aliases(Eval eval, ImportDecisionsDto decisions, UUID leagueId) {
        List<RememberedAlias> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Resolution r : eval.sides().all()) {
            if (!r.remember() || r.kind() == ImportResolutionKind.SKIP_ROWS || r.key() == null) {
                continue;
            }
            ResolvedSide side = eval.sides().cached(r.key());
            if (side == null) {
                continue;
            }
            String normalised = ScheduleWorldLoader.aliasKey(r.key());
            if (normalised.isEmpty() || !seen.add(normalised)) {
                continue;
            }
            String original = r.key().length() > 255 ? r.key().substring(0, 255) : r.key();
            String scopeKey = ScheduleWorldLoader.aliasScopeKey(leagueId);
            if (side.ours()) {
                out.add(new RememberedAlias(ScheduleWorldLoader.ALIAS_KIND, scopeKey, normalised, original,
                        ScheduleWorldLoader.ALIAS_OWN_TEAM, side.id(), null));
            } else {
                out.add(new RememberedAlias(ScheduleWorldLoader.ALIAS_KIND, scopeKey, normalised, original,
                        ScheduleWorldLoader.ALIAS_LEAGUE_TEAM, null, side.name()));
            }
        }
        return out;
    }

    // ---- deletion ----------------------------------------------------------------------------------------------

    private record BatchRecords(
            UUID clubId,
            ZoneId zone,
            List<ImportBatchEntity> createdMatches,
            List<ImportBatchEntity> updatedMatches,
            List<ImportBatchEntity> createdTeams,
            ImportBatchEntity leagueDates) {}

    private BatchRecords recordsOf(ImportBatch batch) {
        List<ImportBatchEntity> all = batchEntityRepository.findByBatchIdOrderByCreatedAtAsc(batch.getId());
        List<ImportBatchEntity> createdMatches = new ArrayList<>();
        List<ImportBatchEntity> updatedMatches = new ArrayList<>();
        List<ImportBatchEntity> createdTeams = new ArrayList<>();
        ImportBatchEntity leagueDates = null;
        for (ImportBatchEntity e : all) {
            if (LEAGUE_SEASON.equals(e.getEntityType()) && e.getAction() == ImportEntityAction.UPDATED) {
                leagueDates = e;
            } else if (MATCH.equals(e.getEntityType()) && e.getAction() == ImportEntityAction.CREATED) {
                createdMatches.add(e);
            } else if (MATCH.equals(e.getEntityType()) && e.getAction() == ImportEntityAction.UPDATED) {
                updatedMatches.add(e);
            } else if (LEAGUE_TEAM.equals(e.getEntityType()) && e.getAction() == ImportEntityAction.CREATED) {
                createdTeams.add(e);
            }
        }
        return new BatchRecords(batch.getClubId(), zoneOf(batch.getTimeZone()), createdMatches, updatedMatches, createdTeams, leagueDates);
    }

    private static List<UUID> ids(List<ImportBatchEntity> entities) {
        return entities.stream().map(ImportBatchEntity::getEntityId).toList();
    }

    /** What happens to each league team the batch created, given the matches that will be deleted. */
    private record TeamFate(LeagueTeam team, String keepReason) {}

    private List<TeamFate> teamFates(BatchRecords records, Collection<Match> deletedMatches) {
        if (records.createdTeams().isEmpty()) {
            return List.of();
        }
        Map<UUID, LeagueTeam> teams = new HashMap<>();
        leagueTeamRepository.findAllById(ids(records.createdTeams())).forEach(t -> teams.put(t.getId(), t));
        Map<UUID, Long> references = new HashMap<>();
        for (ReferencedMatchCount row : leagueTeamRepository.countReferencingMatches(teams.keySet())) {
            references.put(row.getLeagueTeamId(), row.getMatchCount());
        }
        Map<UUID, Long> fromBatch = new HashMap<>();
        for (Match m : deletedMatches) {
            for (UUID id : new UUID[] {m.getHomeLeagueTeamId(), m.getAwayLeagueTeamId()}) {
                if (id != null) {
                    fromBatch.merge(id, 1L, Long::sum);
                }
            }
        }
        List<TeamFate> out = new ArrayList<>();
        for (ImportBatchEntity e : records.createdTeams()) {
            LeagueTeam team = teams.get(e.getEntityId());
            if (team == null) {
                continue;
            }
            long others = references.getOrDefault(team.getId(), 0L) - fromBatch.getOrDefault(team.getId(), 0L);
            String reason = null;
            if (others > 0) {
                reason = "used by " + others + " other match" + (others == 1 ? "" : "es");
            } else if (!unedited(team, e.getDetail())) {
                reason = "edited since the import";
            } else if (!team.isActive()) {
                reason = "deactivated since the import";
            }
            out.add(new TeamFate(team, reason));
        }
        return out;
    }

    private static boolean unedited(LeagueTeam team, Map<String, Object> snapshot) {
        if (snapshot == null) {
            return false;
        }
        return same(snapshot.get("name"), team.getName()) && same(snapshot.get("abbreviation"), team.getAbbreviation())
                && same(snapshot.get("logoUrl"), team.getLogoUrl());
    }

    private static boolean same(Object recorded, String current) {
        return Objects.equals(recorded == null ? "" : recorded.toString(), current == null ? "" : current);
    }

    private List<Match> existingMatches(Collection<UUID> ids, UUID clubId) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return matchRepository.findAllById(ids).stream().filter(m -> clubId.equals(m.getClubId())).toList();
    }

    @Override
    public DeletionCheckDto checkDeletion(ImportBatch batch) {
        BatchRecords records = recordsOf(batch);
        List<Match> matches = existingMatches(ids(records.createdMatches()), records.clubId());
        Map<UUID, Team> teamsById = teamsById(records.clubId());
        List<DeletionBlockerDto> blocked = blockers.blockers(matches, teamsById, records.zone());
        List<TeamFate> fates = teamFates(records, matches);

        List<String> notes = new ArrayList<>();
        Map<UUID, ImportBatchEntity> createdByMatch = new HashMap<>();
        records.createdMatches().forEach(e -> createdByMatch.put(e.getEntityId(), e));
        long edited = matches.stream().filter(m -> editedSince(m, createdByMatch.get(m.getId()))).count();
        long past = matches.stream().filter(m -> m.getMatchDate().isBefore(Instant.now())).count();
        long inactive = matches.stream().filter(m -> !m.isActive()).count();
        if (edited > 0) {
            notes.add(plural(edited, "match was", "matches were") + " edited since the import.");
        }
        if (past > 0) {
            notes.add(plural(past, "match is", "matches are") + " already in the past.");
        }
        if (inactive > 0) {
            notes.add(plural(inactive, "match is", "matches are") + " deactivated.");
        }
        long reverts = records.updatedMatches().size();
        if (reverts > 0) {
            notes.add(plural(reverts, "match changed", "matches changed") + " by this import will be set back when nothing is attached to "
                    + (reverts == 1 ? "it" : "them") + ", and otherwise left as changed.");
        }
        if (records.leagueDates() != null) {
            notes.add("The league dates were extended by this import. They will be restored when no other match of this "
                    + "league and season falls outside the previous dates, and otherwise left as changed.");
        }
        int keep = 0;
        int delete = 0;
        for (TeamFate fate : fates) {
            if (fate.keepReason() == null) {
                delete++;
            } else {
                keep++;
                notes.add("Kept: " + fate.team().getName() + " (" + fate.keepReason() + ").");
            }
        }
        Map<String, Integer> willDelete = new LinkedHashMap<>();
        willDelete.put("matches", matches.size());
        willDelete.put("leagueTeams", delete);
        Map<String, Integer> willKeep = new LinkedHashMap<>();
        willKeep.put("leagueTeams", keep);
        return new DeletionCheckDto(blocked.isEmpty(), blocked, willDelete, willKeep, notes);
    }

    private static String plural(long n, String one, String many) {
        return n + " " + (n == 1 ? one : many);
    }

    private static boolean editedSince(Match match, ImportBatchEntity entity) {
        if (entity == null || entity.getDetail() == null) {
            return false;
        }
        return !same(entity.getDetail().get("start"), match.getMatchDate().toString())
                || !same(entity.getDetail().get("venue"), match.getVenue());
    }

    private Map<UUID, Team> teamsById(UUID clubId) {
        Map<UUID, Team> map = new HashMap<>();
        teamRepository.findByClubId(clubId).forEach(t -> map.put(t.getId(), t));
        return map;
    }

    @Override
    public void delete(Authentication auth, ImportBatch batch) {
        BatchRecords records = recordsOf(batch);
        UUID clubId = records.clubId();
        // Lock the matches, then check again inside this transaction: a poll created a moment ago must block.
        List<Match> locked = records.createdMatches().isEmpty()
                ? List.of()
                : matchRepository.findAllByIdForUpdate(ids(records.createdMatches())).stream()
                        .filter(m -> clubId.equals(m.getClubId())).toList();
        Map<UUID, Team> teamsById = teamsById(clubId);
        List<DeletionBlockerDto> blocked = blockers.blockers(locked, teamsById, records.zone());
        if (!blocked.isEmpty()) {
            throw blocked(blocked);
        }
        List<Match> ordered = new ArrayList<>(locked);
        ordered.sort(Comparator.comparing(Match::getMatchDate).thenComparing(Match::getId));
        try {
            for (Match match : ordered) {
                matchService.delete(auth, clubId, match.getId());
            }
        } catch (MatchNotEmptyException | DataIntegrityViolationException ex) {
            List<DeletionBlockerDto> now = blockers.blockers(locked, teamsById, records.zone());
            throw blocked(now.isEmpty()
                    ? List.of(new DeletionBlockerDto(MATCH, null, "A match created by this import", List.of("IN_USE"),
                            "Something started using a match while the import was being deleted.", null))
                    : now);
        }
        revertUpdates(auth, records, new HashSet<>(ids(records.createdMatches())));
        restoreLeagueDates(auth, batch, records);

        // League teams the batch created go only when nothing else uses them and nobody changed them.
        for (TeamFate fate : teamFates(records, List.of())) {
            if (fate.keepReason() == null) {
                LeagueTeam team = fate.team();
                leagueTeamService.remove(clubId, team.getLeagueId(), team.getSeasonId(), team.getId());
            }
        }
    }

    /**
     * Puts the league dates back when this import extended them and no remaining active match of the league and season
     * falls outside the previous range; otherwise they are left as changed. The check reads first so a refusal never
     * marks the transaction rollback-only.
     */
    private void restoreLeagueDates(Authentication auth, ImportBatch batch, BatchRecords records) {
        ImportBatchEntity e = records.leagueDates();
        if (e == null || e.getPrevious() == null || e.getEntityId() == null) {
            return;
        }
        UUID leagueId = e.getEntityId();
        Object seasonRaw = e.getDetail() == null ? null : e.getDetail().get("seasonId");
        if (seasonRaw == null) {
            return;
        }
        UUID seasonId = UUID.fromString(seasonRaw.toString());
        LocalDate start = LocalDate.parse(String.valueOf(e.getPrevious().get("start")));
        LocalDate end = LocalDate.parse(String.valueOf(e.getPrevious().get("end")));
        OutsideDatesSummary outside = matchRepository.summariseOutsideDates(leagueId, seasonId,
                ServerClock.startOfDay(start), ServerClock.startOfDay(end.plusDays(1)));
        if (outside.getMatchCount() > 0) {
            return;
        }
        leagueSeasonDatesService.update(records.clubId(), leagueId, seasonId,
                new UpdateLeagueSeasonDatesRequest(start, end), accessService.resolveCurrentPersonId(auth));
    }

    private static ImportDeletionBlockedException blocked(List<DeletionBlockerDto> blockers) {
        return new ImportDeletionBlockedException(
                "This import cannot be deleted because something it created is now in use.", blockers);
    }

    /**
     * Sets the matches the batch updated (and did not create) back to their previous time and venue, when nothing is
     * attached to them and nobody changed them since; otherwise they are left as changed (reported by the check).
     */
    private void revertUpdates(Authentication auth, BatchRecords records, Set<UUID> createdIds) {
        List<ImportBatchEntity> updates = records.updatedMatches().stream()
                .filter(e -> !createdIds.contains(e.getEntityId())).toList();
        if (updates.isEmpty()) {
            return;
        }
        Map<UUID, Match> current = new HashMap<>();
        existingMatches(ids(updates), records.clubId()).forEach(m -> current.put(m.getId(), m));
        Map<UUID, Set<String>> dependants = blockers.reasonsFor(current.keySet());
        for (ImportBatchEntity e : updates) {
            Match match = current.get(e.getEntityId());
            if (match == null || !dependants.getOrDefault(match.getId(), Set.of()).isEmpty()
                    || e.getPrevious() == null || e.getDetail() == null) {
                continue;
            }
            boolean untouched = same(e.getDetail().get("start"), match.getMatchDate().toString())
                    && same(e.getDetail().get("venue"), match.getVenue());
            if (!untouched) {
                continue;
            }
            Instant start = Instant.parse(String.valueOf(e.getPrevious().get("start")));
            Object venue = e.getPrevious().get("venue");
            String oldVenue = venue == null || venue.toString().isEmpty() ? null : venue.toString();
            boolean venueChanged = !same(e.getPrevious().get("venue"), match.getVenue());
            MatchDto dto = matchService.get(auth, records.clubId(), match.getId());
            matchService.update(auth, records.clubId(), match.getId(), updateRequest(dto, start, oldVenue, venueChanged));
        }
    }
}
