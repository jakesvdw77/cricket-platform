package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.NameAliasKind;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.dto.AdaptorCatalogueDto;
import com.cricketlegend.dto.ExistingResultDto;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportLimitsDto;
import com.cricketlegend.dto.ImportNoteDto;
import com.cricketlegend.dto.ImportNoteSeverity;
import com.cricketlegend.dto.ImportOrigin;
import com.cricketlegend.dto.ImportPreviewDto;
import com.cricketlegend.dto.ImportPreviewRequest;
import com.cricketlegend.dto.ImportResolveDto;
import com.cricketlegend.dto.ImportResolveRequest;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.dto.TeamMappingDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.ImportMatchAlreadyHasResultException;
import com.cricketlegend.exception.ImportWouldOverwriteDraftException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.AdaptorMapper;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.ResultImportService;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.adaptor.Adaptor;
import com.cricketlegend.service.adaptor.AdaptorRegistry;
import com.cricketlegend.service.adaptor.ImportInput;
import com.cricketlegend.service.adaptor.ImportedResultValidator;
import com.cricketlegend.service.support.ImportMatchLocator;
import com.cricketlegend.service.support.ImportMatchLocator.Located;
import com.cricketlegend.service.support.ImportOrigins;
import com.cricketlegend.service.support.ImportTeamMapper;
import com.cricketlegend.service.support.NameAliases;
import com.cricketlegend.service.support.ResultImportProcessor;
import com.cricketlegend.service.support.ResultImportProcessor.ProcessedImport;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/104-match-results-import-adaptors.md. The preview runs the adaptor and the read-only locator and team
 * mapper and writes nothing. The resolve is the only write and the explicit confirm: it needs the manager's match,
 * team mapping and overwrite acknowledgement, re-validates the whole document (nothing about it is trusted, exactness
 * included), saves one DRAFT through {@link ResultService#saveImportedDraft} and never publishes. This class and the
 * processor touch no result entity or repository; the raw payload is never stored and no name is logged.
 */
@Service
public class ResultImportServiceImpl implements ResultImportService {

    private final AdaptorRegistry adaptorRegistry;
    private final AdaptorMapper adaptorMapper;
    private final MatchService matchService;
    private final ResultService resultService;
    private final ImportMatchLocator locator;
    private final ImportTeamMapper teamMapper;
    private final ResultImportProcessor processor;
    private final NameAliases nameAliases;
    private final AccessService accessService;

    public ResultImportServiceImpl(
            AdaptorRegistry adaptorRegistry,
            AdaptorMapper adaptorMapper,
            MatchService matchService,
            ResultService resultService,
            ImportMatchLocator locator,
            ImportTeamMapper teamMapper,
            ResultImportProcessor processor,
            NameAliases nameAliases,
            AccessService accessService) {
        this.adaptorRegistry = adaptorRegistry;
        this.adaptorMapper = adaptorMapper;
        this.matchService = matchService;
        this.resultService = resultService;
        this.locator = locator;
        this.teamMapper = teamMapper;
        this.processor = processor;
        this.nameAliases = nameAliases;
        this.accessService = accessService;
    }

    /** No database access and no lazy fields, so no transaction is needed. */
    @Override
    public AdaptorCatalogueDto listAdaptors() {
        return new AdaptorCatalogueDto(
                adaptorRegistry.all().stream().map(adaptorMapper::toDescriptor).toList(), ImportLimitsDto.current());
    }

    // ---- preview: reads, writes nothing ----

    @Override
    @Transactional(readOnly = true)
    public ImportPreviewDto preview(
            Authentication authentication, UUID clubId, ImportPreviewRequest request, String fileName, byte[] bytes) {
        Adaptor adaptor = adaptorRegistry.find(request.adaptor())
                .orElseThrow(() -> new ValidationException("Unknown import source: " + request.adaptor()));
        boolean hasFile = bytes != null;
        boolean hasContent = request.content() != null && !request.content().isBlank();
        if (hasFile == hasContent) {
            throw new ValidationException("Give either a file or pasted content, not both and not neither.");
        }
        if (request.matchId() != null) {
            matchService.requireAdministrableMatch(authentication, clubId, request.matchId());
        }
        ImportInput input = hasFile
                ? ImportInput.file(request.format(), fileName, bytes)
                : ImportInput.paste(request.format(), request.content());
        ImportedResultDto document = adaptor.importFrom(input);

        List<Located> located = locator.locate(authentication, clubId, document, request.matchId());
        Located chosen = located.stream()
                .filter(l -> request.matchId() != null && l.candidate().matchId().equals(request.matchId()))
                .findFirst()
                .orElse(located.isEmpty() ? null : located.get(0));
        List<TeamMappingDto> mapping = chosen == null ? List.of() : chosen.teamMapping();
        List<ImportNoteDto> notes = new ArrayList<>();
        if (located.isEmpty()) {
            notes.add(ImportNoteDto.of("NO_MATCH_CANDIDATE", ImportNoteSeverity.WARNING, "match",
                    "No match in your fixtures fits this file. Create the match first, then import again."));
        }
        mapping.stream().filter(m -> m.exactness() == ImportExactness.UNRESOLVED).forEach(m -> notes.add(
                ImportNoteDto.of("TEAM_UNRESOLVED", ImportNoteSeverity.WARNING, "teams",
                        "'" + m.fileName() + "' could not be placed on a side of the match. Choose the side.")));

        Map<String, ImportExactness> teamLevels = new LinkedHashMap<>();
        mapping.forEach(m -> teamLevels.put(m.fileKey(), m.exactness()));
        ImportedResultDto withExactness = document.withPreviewExactness(
                chosen == null ? ImportExactness.UNRESOLVED : ImportMatchLocator.exactnessOf(chosen.candidate().reasons()),
                teamLevels,
                document.toss() == null ? null : teamLevels.getOrDefault(document.toss().wonBy(), ImportExactness.UNRESOLVED),
                document.result() == null || document.result().winner() == null
                        ? ImportExactness.EXACT
                        : teamLevels.getOrDefault(document.result().winner(), ImportExactness.UNRESOLVED));
        ImportOrigin origin = ImportOrigins.of(document);
        ExistingResultDto imported = origin.externalId() == null
                ? null
                : resultService.findImported(clubId, origin.source(), origin.externalId()).orElse(null);
        return new ImportPreviewDto(
                withExactness, located.stream().map(Located::candidate).toList(), mapping, imported, notes);
    }

    // ---- resolve: the only write ----

    @Override
    @Transactional
    public ImportResolveDto resolve(Authentication authentication, UUID clubId, ImportResolveRequest request) {
        ImportedResultDto document = request.document();
        List<ImportErrorDto> errors = ImportedResultValidator.validate(document);
        if (!errors.isEmpty()) {
            throw new ImportInputValidationException("The document does not follow the common import format.", errors);
        }
        Match match = matchService.requireAdministrableMatch(authentication, clubId, request.matchId());
        if (match.getHomeTeamId() == null && match.getAwayTeamId() == null) {
            // Neither side is one of the club's teams, so there is nobody of ours to import; the scorecard rules would refuse it with a vaguer message.
            throw new ImportInputValidationException("The match has no team of this club.", List.of(new ImportErrorDto(
                    "match", "NO_CLUB_TEAM_ON_MATCH",
                    "Neither team of this match is one of your club's teams, so nobody on the scorecard can be linked to your players."
                            + " Edit the match and choose your own team as home or away, then import again.")));
        }
        ExistingResultDto existing = resultService.existingResults(clubId, List.of(match.getId())).get(match.getId());
        if (existing != null && existing.status() == ResultStatus.PUBLISHED) {
            throw new ImportMatchAlreadyHasResultException(
                    "This match already has a published result. Unpublish it before importing.");
        }
        if (existing != null && !request.replaceExistingDraft()) {
            throw new ImportWouldOverwriteDraftException(
                    "This match already has a draft result. Confirm that it can be replaced.");
        }
        Map<String, ResultSide> sideByKey = teamMapper.confirm(document.teams(), request.teamMapping());

        Located located = locator.locate(authentication, clubId, document, match.getId()).stream()
                .filter(l -> l.candidate().matchId().equals(match.getId()))
                .findFirst()
                .orElse(null);
        List<TeamMappingDto> proposed = located == null
                ? document.teams().stream()
                        .map(t -> new TeamMappingDto(t.key(), t.name(), null, ImportExactness.UNRESOLVED, null))
                        .toList()
                : located.teamMapping();
        Map<String, ImportExactness> teamExactness = teamMapper.confirmedExactness(proposed, sideByKey);

        ProcessedImport processed = processor.process(clubId, match, document, sideByKey, teamExactness);
        resultService.saveImportedDraft(
                authentication, clubId, match.getId(), processed.draft(), ImportOrigins.of(document));
        rememberTeams(authentication, clubId, match, document, sideByKey, teamExactness);
        ResultValidationDto validation = resultService.validate(authentication, clubId, match.getId(), null);

        Map<String, ImportExactness> exactness = new LinkedHashMap<>();
        exactness.put("match", located == null
                ? ImportExactness.UNRESOLVED
                : ImportMatchLocator.exactnessOf(located.candidate().reasons()));
        exactness.putAll(processed.exactness());
        return new ImportResolveDto(
                match.getId(), ResultStatus.DRAFT, exactness, processed.counts(), processed.notes(), validation);
    }

    /** Confirming a team mapping that was not an exact name match remembers the file's spelling for our team. */
    private void rememberTeams(
            Authentication authentication, UUID clubId, Match match, ImportedResultDto document,
            Map<String, ResultSide> sideByKey, Map<String, ImportExactness> teamExactness) {
        UUID person = accessService.resolveCurrentPersonId(authentication);
        for (ImportedResultDto.Team team : document.teams()) {
            ResultSide side = sideByKey.get(team.key());
            UUID ourTeam = side == ResultSide.HOME ? match.getHomeTeamId() : match.getAwayTeamId();
            if (ourTeam != null && teamExactness.get(team.key()) != ImportExactness.EXACT) {
                nameAliases.remember(clubId, NameAliasKind.TEAM, team.name(), ourTeam, person);
            }
        }
    }
}
