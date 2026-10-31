package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.PlannedChangeDto;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.core.JsonProcessingException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * SHA-256 digests of the canonical JSON of what the user reviewed (docs/specs/097-import-framework.md, principle 1 and
 * R1). Maps are key-sorted and properties alphabetical, so the same effective import always gives the same digest, and
 * a different scope, scope mode, template scope, time zone, row, resolution, update opt-in or planned change gives a
 * different one. Acknowledgements are deliberately not part of it (they gate the token, they do not change the import).
 */
@Component
public class ImportDigest {

    private final ObjectMapper canonical = new ObjectMapper()
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
            .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true);

    /** Digest of the effective import and the planned changes that would result. */
    public String of(EffectiveImport effective, List<PlannedChangeDto> planned) {
        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("type", effective.type());
        doc.put("templateVersion", effective.templateVersion());
        doc.put("clubId", effective.scope().clubId());
        doc.put("scopeParams", effective.scope().params());
        doc.put("scopeMode", effective.scope().scopeMode());
        doc.put("templateScope", effective.scope().templateScope());
        doc.put("timeZone", effective.timeZone());
        doc.put("rows", rowDocuments(effective.rows()));
        doc.put("resolutions", effective.decisions().resolutions());
        doc.put("updates", normalisedUpdates(effective.decisions().updates()));
        doc.put("updateAllDiffering", effective.decisions().updateAllDiffering());
        doc.put("identifiedAsOurs", sorted(effective.decisions().identifiedAsOurs()));
        doc.put("options", effective.decisions().options());
        doc.put("planned", planned);
        return hash(doc);
    }

    /**
     * Rows as hashed: values and results only. The provenance fields {@code origin} and {@code fileValues} (spec 125)
     * are display data and are left out, so only a change of data changes the digest.
     */
    private static List<Map<String, Object>> rowDocuments(List<ImportRowDto> rows) {
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (ImportRowDto row : rows) {
            Map<String, Object> doc = new LinkedHashMap<>();
            doc.put("rowNumber", row.rowNumber());
            doc.put("sourceRef", row.sourceRef());
            doc.put("values", row.values());
            doc.put("status", row.status());
            doc.put("outcome", row.outcome());
            doc.put("action", row.action());
            doc.put("issueCodes", row.issueCodes());
            doc.put("existingRef", row.existingRef());
            out.add(doc);
        }
        return out;
    }

    /** Digest of the "will be created and updated" list, the second value the user confirms. */
    public String creations(List<PlannedChangeDto> planned) {
        return hash(planned);
    }

    /** Hash of the normalised row values, for the whole-file re-import check (row positions and results are ignored). */
    public String rows(List<ImportRowDto> rows) {
        List<Map<String, Object>> values = new ArrayList<>(rows.size());
        for (ImportRowDto row : rows) {
            values.add(row.values());
        }
        return hash(values);
    }

    public String sha256(byte[] content) {
        return HexFormat.of().formatHex(digest().digest(content));
    }

    private String hash(Object document) {
        try {
            return sha256(canonical.writeValueAsBytes(document));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("The import digest could not be computed", ex);
        }
    }

    /**
     * Updates in canonical form: ordered by row, attributes sorted and de-duplicated. An empty attributes list means
     * ALL allowed attributes and stays empty, so the digest never depends on how the same opt-in was ordered or repeated.
     */
    private static List<Map<String, Object>> normalisedUpdates(List<ImportDecisionsDto.RowUpdate> updates) {
        List<Map<String, Object>> out = new ArrayList<>(updates.size());
        for (ImportDecisionsDto.RowUpdate update : updates.stream()
                .sorted(java.util.Comparator.comparingInt(ImportDecisionsDto.RowUpdate::rowNumber)).toList()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("rowNumber", update.rowNumber());
            entry.put("attributes", update.attributes().stream().distinct().sorted().toList());
            out.add(entry);
        }
        return out;
    }

    private static List<String> sorted(List<String> values) {
        List<String> copy = new ArrayList<>(values);
        copy.sort(String::compareTo);
        return copy;
    }

    private static MessageDigest digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
