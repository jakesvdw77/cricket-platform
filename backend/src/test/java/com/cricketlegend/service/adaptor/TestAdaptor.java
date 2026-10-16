package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportedResultDto;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

/**
 * The minimal adaptor of docs/specs/104's Test Plan: a test-only subclass of {@link AbstractAdaptor} that overrides
 * nothing it does not have to, records the order of the template method's steps, and emits whatever document the test
 * gives it. Not a Spring bean here; registry tests wrap it explicitly.
 */
public class TestAdaptor extends AbstractAdaptor {

    private static final long serialVersionUID = 1L;

    public final transient List<String> calls = new ArrayList<>();
    private final Set<ImportInputFormat> formats;
    private final transient Function<AdaptorContent, ImportedResultDto> transformer;

    public TestAdaptor(AdaptorType type, Set<ImportInputFormat> formats, Function<AdaptorContent, ImportedResultDto> transformer) {
        super(type);
        this.formats = formats;
        this.transformer = transformer;
    }

    public static TestAdaptor json(ImportedResultDto emits) {
        return new TestAdaptor(AdaptorType.JSON, Set.of(ImportInputFormat.JSON), content -> emits);
    }

    @Override
    public String getDisplayName() {
        return "Test adaptor";
    }

    @Override
    public String getDescription() {
        return "Only for tests.";
    }

    @Override
    public Set<ImportInputFormat> getSupportedFormats() {
        return formats;
    }

    @Override
    public AdaptorContent read(ImportInput input) {
        calls.add("read");
        return super.read(input);
    }

    @Override
    public void validate(AdaptorContent content) {
        calls.add("validate");
    }

    @Override
    public ImportedResultDto transform(AdaptorContent content, AdaptorContext context) {
        calls.add("transform");
        return transformer.apply(content);
    }
}
