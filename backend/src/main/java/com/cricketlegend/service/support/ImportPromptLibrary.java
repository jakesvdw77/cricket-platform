package com.cricketlegend.service.support;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * The versioned "Convert with AI" prompt text, served from one place (docs/specs/097-import-framework.md): classpath
 * resources {@code imports/prompts/<type>/v<templateVersion>.md}. The prompt version and template version move together;
 * the UI never hard-codes prompt text. The type is checked against a strict pattern before it touches a path.
 */
@Component
public class ImportPromptLibrary {

    private static final Pattern SAFE_TYPE = Pattern.compile("[A-Z0-9_]{1,64}");

    public Optional<String> load(String type, int templateVersion) {
        if (type == null || !SAFE_TYPE.matcher(type).matches()) {
            return Optional.empty();
        }
        ClassPathResource resource = new ClassPathResource("imports/prompts/" + type + "/v" + templateVersion + ".md");
        if (!resource.exists()) {
            return Optional.empty();
        }
        try (InputStream in = resource.getInputStream()) {
            return Optional.of(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException ex) {
            return Optional.empty();
        }
    }
}
