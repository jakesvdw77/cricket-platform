package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.cricketlegend.exception.UnsupportedImportFormatException;
import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonSubTypes.Type;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.constraints.NotNull;
import java.io.Serializable;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * docs/specs/104-match-results-import-adaptors.md: the base of every adaptor. Holds the {@link AdaptorType}, the defaults
 * (text formats are decoded as strict UTF-8, AI is not allowed) and the final {@link #importFrom} template method, so
 * no adaptor can skip the format check, the size caps, the source stamp or the common-format validation.
 *
 * <p>Only the descriptive getters are serialised; behaviour methods are not. {@code @JsonSubTypes} keeps the
 * {@code type} property able to deserialise an adaptor-shaped payload to the right subclass (the registry and contract
 * tests, and later per-club adaptor settings). Add one {@code @Type} line per {@link AdaptorType}.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "type", visible = true)
@JsonSubTypes({
    @Type(value = JsonAdaptor.class, name = "JSON")
})
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonAutoDetect(
        getterVisibility = JsonAutoDetect.Visibility.NONE,
        isGetterVisibility = JsonAutoDetect.Visibility.NONE,
        fieldVisibility = JsonAutoDetect.Visibility.NONE,
        setterVisibility = JsonAutoDetect.Visibility.NONE)
public abstract class AbstractAdaptor implements Serializable, Adaptor {

    private static final long serialVersionUID = 1L;

    @NotNull
    private AdaptorType type;

    protected AbstractAdaptor(AdaptorType type) {
        this.type = type;
    }

    @Override
    @JsonProperty("type")
    public AdaptorType getType() {
        return type;
    }

    @Override
    @JsonProperty(value = "displayName", access = JsonProperty.Access.READ_ONLY)
    public abstract String getDisplayName();

    @Override
    @JsonProperty(value = "description", access = JsonProperty.Access.READ_ONLY)
    public abstract String getDescription();

    @Override
    @JsonProperty(value = "supportedFormats", access = JsonProperty.Access.READ_ONLY)
    public abstract Set<ImportInputFormat> getSupportedFormats();

    @Override
    public boolean isSupported(ImportInputFormat format) {
        return getSupportedFormats().contains(format);
    }

    @Override
    @JsonProperty(value = "aiAllowed", access = JsonProperty.Access.READ_ONLY)
    public boolean isAiAllowed() {
        return false;
    }

    @Override
    @JsonProperty(value = "example", access = JsonProperty.Access.READ_ONLY)
    public String getExample() {
        return null;
    }

    @Override
    @JsonProperty(value = "conversionPrompt", access = JsonProperty.Access.READ_ONLY)
    public String getConversionPrompt() {
        return null;
    }

    @Override
    public long maxBytes(ImportInputFormat format) {
        return Math.min(format.getDefaultMaxBytes(), ResultImportLimits.GLOBAL_MAX_FILE_BYTES);
    }

    /** Text formats: strict UTF-8 (a byte order mark is tolerated). Binary formats must override. */
    @Override
    public AdaptorContent read(ImportInput input) {
        if (!input.format().isTextBased()) {
            throw unsupported(input.format());
        }
        return new TextContent(decodeUtf8(input.bytes()));
    }

    @Override
    public final ImportedResultDto importFrom(ImportInput input) {
        ImportInputFormat format = input.format();
        if (!isSupported(format) || (input.isPaste() && !format.isTextBased())) {
            throw unsupported(format);
        }
        checkSize(input);
        AdaptorContent content = input.isPaste() ? new TextContent(input.text()) : read(input);
        validate(content);
        ImportedResultDto document = transform(content, AdaptorContext.of(input))
                .withSource(type, input.fileName());
        List<ImportErrorDto> errors = ImportedResultValidator.validate(document);
        if (!errors.isEmpty()) {
            throw new ImportInputValidationException(
                    "The " + getDisplayName() + " adaptor produced a document that does not follow the common import"
                            + " format. This is a fault in the adaptor, not in your input.",
                    errors);
        }
        return document;
    }

    private void checkSize(ImportInput input) {
        if (input.isPaste()) {
            int length = input.text() == null ? 0 : input.text().length();
            if (length > ResultImportLimits.MAX_PASTE_CHARACTERS) {
                throw tooLarge("The pasted text is longer than " + ResultImportLimits.MAX_PASTE_CHARACTERS
                        + " characters.");
            }
        } else if (input.byteSize() > maxBytes(input.format())) {
            throw tooLarge("The file is larger than " + (maxBytes(input.format()) / (1024 * 1024)) + " MB.");
        }
    }

    private static ImportInputValidationException tooLarge(String message) {
        return new ImportInputValidationException(message, List.of(new ImportErrorDto("", "INPUT_TOO_LARGE", message)));
    }

    private UnsupportedImportFormatException unsupported(ImportInputFormat requested) {
        List<String> supported = getSupportedFormats().stream()
                .sorted(Comparator.naturalOrder())
                .map(Enum::name)
                .toList();
        return new UnsupportedImportFormatException(
                requested.name(),
                supported,
                "The " + getDisplayName() + " adaptor does not accept " + requested.name() + ". It accepts: "
                        + String.join(", ", supported) + ".");
    }

    private static String decodeUtf8(byte[] bytes) {
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
            return text.startsWith("﻿") ? text.substring(1) : text;
        } catch (CharacterCodingException ex) {
            throw new UnreadableImportInputException("The file is not valid UTF-8 text. Save it as UTF-8 and try again.");
        }
    }
}
