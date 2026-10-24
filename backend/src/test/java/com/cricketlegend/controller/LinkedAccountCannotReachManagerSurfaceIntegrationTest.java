package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Section;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.yaml.snakeyaml.Yaml;

/**
 * docs/specs/119, Test Plan: "a person with only links is refused by every /api/v1/manage/** and /api/v1/platform/**
 * operation in the OpenAPI document (generated test, so a new endpoint is covered automatically)".
 *
 * <p>The operations come from the checked-in {@code backend/openapi/openapi.yaml}. Each is called with the token of a
 * verified person who holds an ACTIVE main person_link and no RoleAssignment at all, with the club, player and section
 * ids filled in with the REAL ones the link points at (the hardest case for a club-scoped rule), and a body generated from
 * the operation's schema. Classification: 401, 403 or 404 is a refusal; a 2xx (or any 5xx) fails the test. Any other status
 * (a 400 from body validation that runs before method security, a 405, a 409, a 415) cannot prove a refusal on its own, so
 * the operation must then carry a real {@code @PreAuthorize} (not a bare {@code isAuthenticated()} or {@code permitAll()});
 * an operation that is neither refused over HTTP nor annotated fails with its name, so a new unprotected endpoint is
 * caught the day it is added.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LinkedAccountCannotReachManagerSurfaceIntegrationTest extends AbstractLinkIntegrationTest {

    private static final List<String> METHODS = List.of("get", "post", "put", "patch", "delete");

    /**
     * Operations that are open to ANY authenticated login on purpose, each with the spec that says so. Keep this list
     * explicit and short: it is the only way an operation may answer 2xx to a person with only links, and an entry that
     * stops answering 2xx fails the test so the list cannot go stale.
     */
    private static final Map<String, String> DOCUMENTED_OPEN_TO_ANY_LOGIN = Map.of(
            "POST /api/v1/manage/media",
            "docs/specs/021-club-contacts.md: generic image upload, authenticated() only, nothing is persisted against a club until the URL is saved through a scoped endpoint");

    @Autowired private MockMvc mockMvc;
    @Autowired @Qualifier("requestMappingHandlerMapping") private RequestMappingHandlerMapping handlerMapping;

    private record Operation(String method, String path, Map<String, Object> definition, List<Map<String, Object>> parameters) {
        String name() {
            return method.toUpperCase() + " " + path;
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> load() throws IOException {
        Path file = Files.exists(Path.of("openapi", "openapi.yaml")) ? Path.of("openapi", "openapi.yaml")
                : Path.of("backend", "openapi", "openapi.yaml");
        return new Yaml().load(Files.readString(file));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> resolve(Map<String, Object> root, Object node) {
        Map<String, Object> map = (Map<String, Object>) node;
        while (map.containsKey("$ref")) {
            String[] parts = ((String) map.get("$ref")).replace("#/", "").split("/");
            Object current = root;
            for (String part : parts) {
                current = ((Map<String, Object>) current).get(part);
            }
            map = (Map<String, Object>) current;
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private static List<Operation> operations(Map<String, Object> root) {
        List<Operation> result = new ArrayList<>();
        Map<String, Object> paths = (Map<String, Object>) root.get("paths");
        for (Map.Entry<String, Object> entry : new TreeMap<>(paths).entrySet()) {
            String path = entry.getKey();
            if (!path.startsWith("/api/v1/manage/") && !path.startsWith("/api/v1/platform/")) {
                continue;
            }
            Map<String, Object> item = (Map<String, Object>) entry.getValue();
            for (String method : METHODS) {
                if (!item.containsKey(method)) {
                    continue;
                }
                Map<String, Object> definition = (Map<String, Object>) item.get(method);
                List<Map<String, Object>> parameters = new ArrayList<>();
                for (Object source : new Object[] {item.get("parameters"), definition.get("parameters")}) {
                    if (source != null) {
                        for (Object p : (List<Object>) source) {
                            parameters.add(resolve(root, p));
                        }
                    }
                }
                result.add(new Operation(method, path, definition, parameters));
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Object sample(Map<String, Object> root, Object schemaNode, int depth) {
        if (schemaNode == null || depth > 6) {
            return null;
        }
        Map<String, Object> schema = resolve(root, schemaNode);
        if (schema.containsKey("enum")) {
            return ((List<Object>) schema.get("enum")).get(0);
        }
        if (schema.containsKey("allOf")) {
            Map<String, Object> merged = new java.util.LinkedHashMap<>();
            for (Object part : (List<Object>) schema.get("allOf")) {
                Object value = sample(root, part, depth + 1);
                if (value instanceof Map<?, ?> m) {
                    merged.putAll((Map<String, Object>) m);
                }
            }
            return merged;
        }
        for (String key : new String[] {"oneOf", "anyOf"}) {
            if (schema.containsKey(key)) {
                return sample(root, ((List<Object>) schema.get(key)).get(0), depth + 1);
            }
        }
        Object type = schema.get("type");
        if (type instanceof List<?> list) {
            Object chosen = "string";
            for (Object t : list) {
                if (!"null".equals(t)) {
                    chosen = t;
                    break;
                }
            }
            type = chosen;
        }
        if (type == null && schema.containsKey("properties")) {
            type = "object";
        }
        String format = (String) schema.get("format");
        switch (type == null ? "string" : type.toString()) {
            case "object": {
                Map<String, Object> out = new java.util.LinkedHashMap<>();
                Map<String, Object> properties = (Map<String, Object>) schema.getOrDefault("properties", Map.of());
                List<String> required = (List<String>) schema.getOrDefault("required", List.of());
                for (String name : required) {
                    out.put(name, sample(root, properties.get(name), depth + 1));
                }
                return out;
            }
            case "array":
                return List.of(sample(root, schema.get("items"), depth + 1));
            case "integer":
                return schema.containsKey("minimum") ? schema.get("minimum") : 1;
            case "number":
                return schema.containsKey("minimum") ? schema.get("minimum") : 1;
            case "boolean":
                return true;
            default:
                if ("uuid".equals(format)) {
                    return UUID.randomUUID().toString();
                }
                if ("email".equals(format)) {
                    return "someone@example.com";
                }
                if ("date".equals(format)) {
                    return "2012-06-15";
                }
                if ("date-time".equals(format)) {
                    return "2026-01-01T00:00:00Z";
                }
                if ("uri".equals(format)) {
                    return "https://example.com/x";
                }
                int min = schema.get("minLength") instanceof Integer i ? i : 1;
                return "x".repeat(Math.max(1, min));
        }
    }

    @SuppressWarnings("unchecked")
    private static String valueFor(Map<String, Object> root, Map<String, Object> parameter, Map<String, String> known) {
        String name = (String) parameter.get("name");
        if (known.containsKey(name)) {
            return known.get(name);
        }
        Object value = sample(root, parameter.get("schema"), 0);
        return String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private MockHttpServletRequestBuilder request(
            Map<String, Object> root, Operation op, Map<String, String> known, org.springframework.test.web.servlet.request.RequestPostProcessor who)
            throws Exception {
        String url = op.path();
        for (Map<String, Object> p : op.parameters()) {
            if ("path".equals(p.get("in"))) {
                url = url.replace("{" + p.get("name") + "}", valueFor(root, p, known));
            }
        }
        Object body = op.definition().get("requestBody");
        MockHttpServletRequestBuilder builder;
        Map<String, Object> content = body == null ? Map.of() : (Map<String, Object>) resolve(root, body).getOrDefault("content", Map.of());
        HttpMethod method = HttpMethod.valueOf(op.method().toUpperCase());
        if (content.containsKey("multipart/form-data")) {
            builder = MockMvcRequestBuilders.multipart(method, url)
                    .file(new MockMultipartFile("file", "x.png", "image/png", new byte[] {1, 2, 3}));
        } else {
            builder = MockMvcRequestBuilders.request(method, url);
            if (content.containsKey("application/json")) {
                Map<String, Object> media = (Map<String, Object>) content.get("application/json");
                builder.contentType(MediaType.APPLICATION_JSON)
                        .content(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(sample(root, media.get("schema"), 0)));
            } else if (!content.isEmpty()) {
                builder.contentType(content.keySet().iterator().next()).content("x");
            }
        }
        for (Map<String, Object> p : op.parameters()) {
            if ("query".equals(p.get("in")) && Boolean.TRUE.equals(p.get("required"))) {
                builder.param((String) p.get("name"), valueFor(root, p, known));
            }
        }
        return builder.with(who);
    }

    private Map<String, HandlerMethod> handlers() {
        Map<String, HandlerMethod> result = new TreeMap<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> e : handlerMapping.getHandlerMethods().entrySet()) {
            Set<String> patterns = e.getKey().getPathPatternsCondition() == null
                    ? Set.of() : e.getKey().getPathPatternsCondition().getPatternValues();
            for (String pattern : patterns) {
                for (org.springframework.web.bind.annotation.RequestMethod m : e.getKey().getMethodsCondition().getMethods()) {
                    result.put(m.name() + " " + pattern, e.getValue());
                }
            }
        }
        return result;
    }

    private static boolean hasRealPreAuthorize(HandlerMethod handler) {
        PreAuthorize annotation = AnnotatedElementUtils.findMergedAnnotation(handler.getMethod(), PreAuthorize.class);
        if (annotation == null) {
            annotation = AnnotatedElementUtils.findMergedAnnotation(handler.getBeanType(), PreAuthorize.class);
        }
        if (annotation == null) {
            return false;
        }
        String expression = annotation.value().replace(" ", "");
        return !expression.equals("permitAll()") && !expression.equals("isAuthenticated()") && !expression.equals("true");
    }

    @Test
    void aPersonWithOnlyPersonLinksIsRefusedByEveryManageAndPlatformOperationInTheOpenApiDocument() throws Exception {
        Map<String, Object> root = load();
        List<Operation> operations = operations(root);

        // the link only person: a verified login, one ACTIVE main link, NO RoleAssignment
        Club club = club("Hillcrest");
        Section section = section(club, "Juniors");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile profile = profile(club, kid, null);
        tag(profile, section);
        Person linkOnly = account("Pat", "Parent");
        var link = link(linkOnly, kid, club, true);
        assertThat(roleAssignmentRepository.findByPersonId(linkOnly.getId())).isEmpty();
        Map<String, String> known = Map.of(
                "clubId", club.getId().toString(),
                "playerId", profile.getId().toString(),
                "sectionId", section.getId().toString(),
                "linkId", link.getId().toString());

        // controls: the token is real (it holds the player through /me) and the request building reaches working endpoints
        mockMvc.perform(get("/api/v1/me/players").with(as(linkOnly)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        Person admin = clubAdmin(club);
        mockMvc.perform(get("/api/v1/manage/clubs/{c}/players", club.getId()).with(as(admin))).andExpect(status().isOk());

        Map<String, HandlerMethod> handlers = handlers();
        List<String> failures = new ArrayList<>();
        int refusedOverHttp = 0;
        int refusedByAnnotation = 0;
        Set<String> exceptionsSeen = new java.util.HashSet<>();
        for (Operation op : operations) {
            int actual = mockMvc.perform(request(root, op, known, as(linkOnly))).andReturn().getResponse().getStatus();
            if (actual == 401 || actual == 403 || actual == 404) {
                refusedOverHttp++;
            } else if (actual >= 200 && actual < 300 && DOCUMENTED_OPEN_TO_ANY_LOGIN.containsKey(op.name())) {
                exceptionsSeen.add(op.name());
            } else if (actual >= 200 && actual < 300) {
                failures.add(op.name() + " answered " + actual + " to a person with only links");
            } else if (actual >= 500) {
                failures.add(op.name() + " answered " + actual + " (server error, cannot classify)");
            } else {
                HandlerMethod handler = handlers.get(op.name());
                if (handler != null && hasRealPreAuthorize(handler)) {
                    refusedByAnnotation++; // e.g. 400 from body validation, which runs before method security
                } else {
                    failures.add(op.name() + " answered " + actual + " and has no @PreAuthorize (cannot classify)");
                }
            }
        }

        assertThat(failures).as("operations a person with only links can reach or that cannot be classified").isEmpty();
        // the sweep really covered the document, and most operations were refused over HTTP itself
        assertThat(operations.size()).isGreaterThan(150);
        assertThat(exceptionsSeen).as("documented exceptions must still be open, else remove them from the list")
                .isEqualTo(DOCUMENTED_OPEN_TO_ANY_LOGIN.keySet());
        assertThat(refusedOverHttp + refusedByAnnotation + exceptionsSeen.size()).isEqualTo(operations.size());
        assertThat(refusedOverHttp).as("refused over HTTP (annotation fallback: " + refusedByAnnotation + ")")
                .isGreaterThan(operations.size() / 2);
    }

    @Test
    void theSweepCoversTheLinkFeatureOperationsAndTheCheckedInSchemaDocumentsThem() throws Exception {
        Map<String, Object> root = load();
        @SuppressWarnings("unchecked")
        Map<String, Object> paths = (Map<String, Object>) root.get("paths");

        assertThat(paths.keySet()).contains(
                "/api/v1/me/player-matches", "/api/v1/me/links", "/api/v1/me/link-requests", "/api/v1/me/clubs",
                "/api/v1/me/invitations", "/api/v1/me/profiles", "/api/v1/me/register", "/api/v1/me/players",
                "/api/v1/me/players/{playerKey}", "/api/v1/me/players/{playerKey}/agents",
                "/api/v1/me/players/{playerKey}/polls", "/api/v1/me/players/{playerKey}/polls/{pollId}/answers",
                "/api/v1/manage/clubs/{clubId}/link-requests", "/api/v1/manage/clubs/{clubId}/link-requests/summary",
                "/api/v1/manage/clubs/{clubId}/player-accounts", "/api/v1/manage/clubs/{clubId}/players/{playerId}/links",
                "/api/v1/manage/clubs/{clubId}/players/{playerId}/links/{linkId}/make-main");
        List<String> swept = operations(root).stream().map(Operation::name).toList();
        assertThat(swept).contains(
                "GET /api/v1/manage/clubs/{clubId}/link-requests",
                "POST /api/v1/manage/clubs/{clubId}/link-requests/{requestId}/approve",
                "GET /api/v1/manage/clubs/{clubId}/player-accounts",
                "DELETE /api/v1/manage/clubs/{clubId}/players/{playerId}/links/{linkId}");
        @SuppressWarnings("unchecked")
        Map<String, Object> schemas = (Map<String, Object>) ((Map<String, Object>) root.get("components")).get("schemas");
        @SuppressWarnings("unchecked")
        Map<String, Object> matchProps = (Map<String, Object>) ((Map<String, Object>) schemas.get("PlayerMatchDto")).get("properties");
        assertThat(matchProps.keySet()).contains("birthYear", "adult").doesNotContain("dateOfBirth");
        @SuppressWarnings("unchecked")
        Map<String, Object> meProps = (Map<String, Object>) ((Map<String, Object>) schemas.get("MeAccessDto")).get("properties");
        assertThat(meProps.keySet()).contains("personId", "platformAdmin", "clubAdminClubIds", "profiles");
    }
}
