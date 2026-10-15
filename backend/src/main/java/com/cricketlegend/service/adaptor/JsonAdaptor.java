package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.fasterxml.jackson.core.JsonLocation;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md: the adaptor for our own common import format as JSON, uploaded or
 * pasted. Validation is conformance to the common format, so {@code transform} returns the document unchanged.
 *
 * <p>Parsing is strict, with its own mapper (the application's mapper ignores unknown properties, and changing that
 * would alter every endpoint): an unknown property is an error, so a misspelt {@code bowlr} is not silently dropped.
 * The exceptions are {@code fallOfWickets} and {@code overByOver} (accepted, kept on the document and ignored) and
 * anything under an {@code x-} prefixed property, which is stripped as the adaptor authors' own annotation.
 */
@Component
public class JsonAdaptor extends AbstractAdaptor {

    private static final long serialVersionUID = 1L;
    private static final String ANNOTATION_PREFIX = "x-";

    private static final ObjectMapper STRICT = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    private static final String EXAMPLE = """
            {
              "schemaVersion": 1,
              "source": { "provider": "EXAMPLE", "externalMatchId": "match-1" },
              "match": { "date": "2026-10-10", "startTime": "09:00", "venue": "Main Oval" },
              "teams": [ { "key": "A", "name": "Home Club 1" }, { "key": "B", "name": "Visitors 1" } ],
              "toss": { "wonBy": "B", "decision": "BAT" },
              "result": { "outcome": "WON", "winner": "A", "margin": { "type": "RUNS", "value": 24 }, "scheduledOvers": 40 },
              "innings": [
                { "battingTeam": "B", "runs": 180, "wickets": 9, "overs": "40.0",
                  "extras": { "wides": 6, "noBalls": 1, "byes": 2, "legByes": 1, "penalty": 0 },
                  "batting": [
                    { "player": "J Smith", "howOut": "CAUGHT", "fielder": "A Nazar", "bowler": "C Mescht",
                      "runs": 42, "balls": 51, "fours": 4, "sixes": 1 }
                  ],
                  "didNotBat": [ "P Jones" ],
                  "bowling": [ { "player": "C Mescht", "overs": "8.0", "maidens": 1, "runs": 31, "wickets": 3, "dots": 22 } ] }
              ],
              "awards": { "playerOfMatch": { "name": "C Mescht" } }
            }
            """;

    public JsonAdaptor() {
        super(AdaptorType.JSON);
    }

    @Override
    public String getDisplayName() {
        return "Cricket Legend JSON";
    }

    @Override
    public String getDescription() {
        return "A match result written in the Cricket Legend common import format, as a JSON file or pasted text.";
    }

    @Override
    public Set<ImportInputFormat> getSupportedFormats() {
        return Set.of(ImportInputFormat.JSON);
    }

    @Override
    public String getExample() {
        return EXAMPLE;
    }

    @Override
    public void validate(AdaptorContent content) {
        List<ImportErrorDto> errors = ImportedResultValidator.validate(parse(content));
        if (!errors.isEmpty()) {
            throw new ImportInputValidationException("The JSON does not follow the common import format.", errors);
        }
    }

    @Override
    public ImportedResultDto transform(AdaptorContent content, AdaptorContext context) {
        return parse(content);
    }

    private ImportedResultDto parse(AdaptorContent content) {
        String text = ((TextContent) content).text();
        if (text == null || text.isBlank()) {
            throw new UnreadableImportInputException("The input is empty.");
        }
        JsonNode tree;
        try {
            tree = STRICT.readTree(text);
        } catch (JsonProcessingException ex) {
            throw new UnreadableImportInputException("The text is not valid JSON" + where(ex.getLocation()) + ".");
        }
        if (tree == null || !tree.isObject()) {
            throw invalid("", "NOT_AN_OBJECT", "The JSON must be one object, as in the example.");
        }
        stripAnnotations(tree);
        try {
            return STRICT.treeToValue(tree, ImportedResultDto.class);
        } catch (JsonMappingException ex) {
            throw invalid(path(ex), code(ex), message(ex));
        } catch (JsonProcessingException ex) {
            throw new UnreadableImportInputException("The JSON could not be read" + where(ex.getLocation()) + ".");
        }
    }

    /** Removes every {@code x-} prefixed property at any depth. */
    private static void stripAnnotations(JsonNode node) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (field.getKey().startsWith(ANNOTATION_PREFIX)) {
                    fields.remove();
                } else {
                    stripAnnotations(field.getValue());
                }
            }
        } else if (node.isArray()) {
            node.forEach(JsonAdaptor::stripAnnotations);
        }
    }

    private static ImportInputValidationException invalid(String path, String code, String message) {
        return new ImportInputValidationException(
                "The JSON does not follow the common import format.", List.of(new ImportErrorDto(path, code, message)));
    }

    private static String where(JsonLocation location) {
        return location == null || location.getLineNr() < 0
                ? ""
                : " (line " + location.getLineNr() + ", column " + location.getColumnNr() + ")";
    }

    private static String path(JsonMappingException ex) {
        StringBuilder path = new StringBuilder();
        for (JsonMappingException.Reference ref : ex.getPath()) {
            if (ref.getFieldName() != null) {
                path.append(path.length() == 0 ? "" : ".").append(ref.getFieldName());
            } else if (ref.getIndex() >= 0) {
                path.append('[').append(ref.getIndex()).append(']');
            }
        }
        return path.toString();
    }

    private static String code(JsonMappingException ex) {
        if (ex instanceof UnrecognizedPropertyException) {
            return "UNKNOWN_PROPERTY";
        }
        return ex instanceof InvalidFormatException || ex instanceof MismatchedInputException
                ? "INVALID_VALUE"
                : "INVALID_DOCUMENT";
    }

    private static String message(JsonMappingException ex) {
        if (ex instanceof UnrecognizedPropertyException unknown) {
            String known = unknown.getKnownPropertyIds() == null ? "" : " Known properties here: "
                    + unknown.getKnownPropertyIds().stream().map(Object::toString).sorted()
                            .collect(Collectors.joining(", ")) + ".";
            return "'" + unknown.getPropertyName() + "' is not a known property." + known
                    + " Use an x- prefix for your own notes.";
        }
        if (ex instanceof InvalidFormatException format) {
            Class<?> target = format.getTargetType();
            String allowed = target != null && target.isEnum()
                    ? " It must be one of: " + Arrays.stream(target.getEnumConstants()).map(Object::toString)
                            .collect(Collectors.joining(", ")) + "."
                    : "";
            return "'" + format.getValue() + "' is not a valid value here." + allowed;
        }
        return "The value has the wrong shape or type for this property.";
    }
}
