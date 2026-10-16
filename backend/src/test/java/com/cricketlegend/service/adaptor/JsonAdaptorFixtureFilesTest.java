package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.exception.ImportInputValidationException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/104-match-results-import-adaptors.md Test Plan: the JSON adaptor reads real files, not only strings built in
 * code, from {@code src/test/resources/imports/results/json}. Invented names only.
 */
class JsonAdaptorFixtureFilesTest {

    private static final Path DIRECTORY = Path.of("src/test/resources/imports/results/json");

    private final JsonAdaptor adaptor = new JsonAdaptor();

    private static byte[] bytes(String name) throws IOException {
        return Files.readAllBytes(DIRECTORY.resolve(name));
    }

    @Test
    void aFullMatchFileIsReadAsAnUpload() throws IOException {
        ImportedResultDto result = adaptor.importFrom(
                new ImportInput(ImportInputFormat.JSON, "full-match.json", bytes("full-match.json"), null));

        assertThat(result.teams()).hasSize(2);
        assertThat(result.innings()).hasSize(2);
        assertThat(result.innings().get(0).batting()).hasSize(4);
        assertThat(result.innings().get(0).didNotBat()).containsExactly("Eve Extra");
    }

    @Test
    void theSameFileInsideAMarkdownFenceIsReadAsAPaste() throws IOException {
        String text = new String(bytes("fenced.json"), StandardCharsets.UTF_8);

        ImportedResultDto fenced = adaptor.importFrom(ImportInput.paste(ImportInputFormat.JSON, text));

        assertThat(fenced.innings()).hasSize(2);
    }

    @Test
    void aFileWithOneTeamIsRefusedWithTheErrorList() {
        assertThatThrownBy(() -> adaptor.importFrom(new ImportInput(
                        ImportInputFormat.JSON, "invalid-no-teams.json", bytes("invalid-no-teams.json"), null)))
                .isInstanceOfSatisfying(ImportInputValidationException.class,
                        e -> assertThat(e.getErrors()).isNotEmpty());
    }
}
