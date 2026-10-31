package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.ImportEntityAction;
import com.cricketlegend.domain.ImportRowOrigin;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.domain.ImportTemplateScope;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportDecisionsDto.Acknowledgement;
import com.cricketlegend.dto.ImportDecisionsDto.RowUpdate;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.PlannedChangeDto;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** docs/specs/097 (digest binds everything reviewed) and 125 (stable when only provenance changes). */
class ImportDigestTest {

    private final ImportDigest digest = new ImportDigest();
    private final UUID club = UUID.randomUUID();

    private ImportScope scope(ImportScopeMode mode, ImportTemplateScope template, Map<String, String> params) {
        return new ImportScope(club, params, mode, template);
    }

    private ImportRowDto row(int number, String home, ImportRowOrigin origin) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("home", home);
        values.put("away", "B");
        return new ImportRowDto(number, "ref", values, null, null, null, List.of(), null, origin, null);
    }

    private EffectiveImport effective(ImportScope scope, String zone, List<ImportRowDto> rows, ImportDecisionsDto decisions) {
        return new EffectiveImport("LEAGUE_SCHEDULE", 1, scope, zone, rows, decisions);
    }

    private final ImportScope baseScope = scope(ImportScopeMode.ALL, ImportTemplateScope.OURS_AND_OTHERS, Map.of("l", "1"));
    private final List<PlannedChangeDto> planned = List.of(
            new PlannedChangeDto(ImportEntityAction.CREATED, "MATCH", "m", 2, null, null));

    private String of(EffectiveImport e) {
        return digest.of(e, planned);
    }

    @Test
    void sameEffectiveImportGivesTheSameDigestEvenWhenMapsAreBuiltInAnotherOrder() {
        Map<String, Object> reversed = new LinkedHashMap<>();
        reversed.put("away", "B");
        reversed.put("home", "A");
        ImportRowDto swappedOrder = new ImportRowDto(2, "ref", reversed, null, null, null, List.of(), null);
        assertThat(of(effective(baseScope, "UTC", List.of(swappedOrder), ImportDecisionsDto.empty())))
                .isEqualTo(of(effective(baseScope, "UTC", List.of(row(2, "A", null)), ImportDecisionsDto.empty())));
    }

    @Test
    void scopeModeTemplateScopeParamsAndZoneAreInTheDigest() {
        String base = of(effective(baseScope, "UTC", List.of(row(2, "A", null)), ImportDecisionsDto.empty()));
        assertThat(of(effective(scope(ImportScopeMode.OURS_ONLY, ImportTemplateScope.OURS_AND_OTHERS, Map.of("l", "1")),
                "UTC", List.of(row(2, "A", null)), ImportDecisionsDto.empty()))).isNotEqualTo(base);
        assertThat(of(effective(scope(ImportScopeMode.ALL, ImportTemplateScope.OURS_ONLY, Map.of("l", "1")),
                "UTC", List.of(row(2, "A", null)), ImportDecisionsDto.empty()))).isNotEqualTo(base);
        assertThat(of(effective(scope(ImportScopeMode.ALL, ImportTemplateScope.OURS_AND_OTHERS, Map.of("l", "2")),
                "UTC", List.of(row(2, "A", null)), ImportDecisionsDto.empty()))).isNotEqualTo(base);
        assertThat(of(effective(baseScope, "Africa/Johannesburg", List.of(row(2, "A", null)), ImportDecisionsDto.empty())))
                .isNotEqualTo(base);
    }

    @Test
    void aChangedRowValueOrPlannedChangeChangesTheDigest() {
        String base = of(effective(baseScope, "UTC", List.of(row(2, "A", null)), ImportDecisionsDto.empty()));
        assertThat(of(effective(baseScope, "UTC", List.of(row(2, "A2", null)), ImportDecisionsDto.empty()))).isNotEqualTo(base);
        assertThat(digest.of(effective(baseScope, "UTC", List.of(row(2, "A", null)), ImportDecisionsDto.empty()), List.of()))
                .isNotEqualTo(base);
    }

    @Test
    void provenanceOfARowIsNotPartOfTheDigest() {
        String file = of(effective(baseScope, "UTC", List.of(row(2, "A", ImportRowOrigin.FILE)), ImportDecisionsDto.empty()));
        String edited = of(effective(baseScope, "UTC", List.of(row(2, "A", ImportRowOrigin.EDITED)), ImportDecisionsDto.empty()));
        assertThat(edited).isEqualTo(file);
    }

    @Test
    void updateOptInsAreNormalisedButAUpdateChoiceChangesTheDigest() {
        ImportDecisionsDto a = new ImportDecisionsDto(null, null, null,
                List.of(new RowUpdate(5, List.of("VENUE", "TIME", "TIME")), new RowUpdate(3, null)), false, null, null, null, null);
        ImportDecisionsDto b = new ImportDecisionsDto(null, null, null,
                List.of(new RowUpdate(3, List.of()), new RowUpdate(5, List.of("TIME", "VENUE"))), false, null, null, null, null);
        List<ImportRowDto> rows = List.of(row(2, "A", null));
        assertThat(of(effective(baseScope, "UTC", rows, a))).isEqualTo(of(effective(baseScope, "UTC", rows, b)));
        assertThat(of(effective(baseScope, "UTC", rows, ImportDecisionsDto.empty()))).isNotEqualTo(of(effective(baseScope, "UTC", rows, a)));
        ImportDecisionsDto all = new ImportDecisionsDto(null, null, null, null, true, null, null, null, null);
        assertThat(of(effective(baseScope, "UTC", rows, all))).isNotEqualTo(of(effective(baseScope, "UTC", rows, ImportDecisionsDto.empty())));
    }

    @Test
    void acknowledgementsAreNotPartOfTheDigest() {
        ImportDecisionsDto acked = new ImportDecisionsDto(null, null, null, null, false,
                List.of(new Acknowledgement("VENUE_MISSING", null)), null, null, null);
        List<ImportRowDto> rows = List.of(row(2, "A", null));
        assertThat(of(effective(baseScope, "UTC", rows, acked)))
                .isEqualTo(of(effective(baseScope, "UTC", rows, ImportDecisionsDto.empty())));
    }

    @Test
    void optionsAndIdentifiedAsOursChangeTheDigestButOrderOfOursDoesNot() {
        List<ImportRowDto> rows = List.of(row(2, "A", null));
        ImportDecisionsDto extend = new ImportDecisionsDto(null, null, null, null, false, null,
                Map.of("extendLeagueDates", true), null, null);
        assertThat(of(effective(baseScope, "UTC", rows, extend)))
                .isNotEqualTo(of(effective(baseScope, "UTC", rows, ImportDecisionsDto.empty())));
        ImportDecisionsDto ab = new ImportDecisionsDto(null, List.of("A", "B"), null, null, false, null, null, null, null);
        ImportDecisionsDto ba = new ImportDecisionsDto(null, List.of("B", "A"), null, null, false, null, null, null, null);
        assertThat(of(effective(baseScope, "UTC", rows, ab))).isEqualTo(of(effective(baseScope, "UTC", rows, ba)));
        assertThat(of(effective(baseScope, "UTC", rows, ab))).isNotEqualTo(of(effective(baseScope, "UTC", rows, ImportDecisionsDto.empty())));
    }

    @Test
    void creationsDigestFollowsThePlannedList() {
        assertThat(digest.creations(planned)).isEqualTo(digest.creations(List.copyOf(planned)));
        assertThat(digest.creations(planned)).isNotEqualTo(digest.creations(List.of()));
    }

    @Test
    void rowsHashIgnoresPositionAndResultsAndShaIsHex() {
        ImportRowDto a = row(2, "A", null);
        ImportRowDto movedAndScored = new ImportRowDto(7, "other", a.values(), com.cricketlegend.domain.ImportRowStatus.OK,
                com.cricketlegend.domain.ImportOutcome.NEW, com.cricketlegend.domain.ImportRowAction.CREATE, List.of("X"), null);
        assertThat(digest.rows(List.of(a))).isEqualTo(digest.rows(List.of(movedAndScored)));
        assertThat(digest.rows(List.of(a))).isNotEqualTo(digest.rows(List.of(row(2, "Z", null))));
        assertThat(digest.sha256(new byte[0])).isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }
}
