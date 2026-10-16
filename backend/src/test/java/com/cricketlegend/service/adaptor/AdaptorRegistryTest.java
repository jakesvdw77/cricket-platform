package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.dto.AdaptorDescriptorDto;
import com.cricketlegend.dto.ImportLimitsDto;
import com.cricketlegend.dto.InputFormatDto;
import com.cricketlegend.mapper.AdaptorMapper;
import com.cricketlegend.support.ImportedResults;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

/**
 * docs/specs/104-match-results-import-adaptors.md Test Plan, "Registry" and "Discovery": automatic discovery of every
 * {@link Adaptor} bean, the duplicate-type failure, one bean and one {@code @Type} per {@link AdaptorType}, the type
 * round-tripping through Jackson, a descriptor-shaped payload deserialising to the right subtype, and the descriptor
 * the mapper produces. This is the only place {@code @JsonSubTypes} is exercised.
 *
 * <p>Not covered here: "a second test-only adaptor appears in discovery with no endpoint change". The enum has one
 * constant ({@code JSON}), so a second adaptor cannot be registered without a second constant. The mapper is shown
 * below to describe an arbitrary adaptor (formats, text-based flag, paste) which is the same property.
 */
class AdaptorRegistryTest {

    private final ObjectMapper json = new ObjectMapper();
    private final AdaptorMapper mapper = Mappers.getMapper(AdaptorMapper.class);

    private static TestAdaptor testAdaptor(String ignored, Set<ImportInputFormat> formats) {
        return new TestAdaptor(AdaptorType.JSON, formats, c -> ImportedResults.builder().build());
    }

    // ---- discovery ----

    @Test
    void everyAdaptorBeanOnTheClasspathIsFoundWithNoRegistration() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.scan("com.cricketlegend.service.adaptor");
            context.refresh();

            AdaptorRegistry registry = context.getBean(AdaptorRegistry.class);
            Map<String, Adaptor> beans = context.getBeansOfType(Adaptor.class);

            assertThat(beans).isNotEmpty();
            assertThat(registry.all()).containsExactlyInAnyOrderElementsOf(beans.values());
            beans.values().forEach(adaptor -> assertThat(registry.find(adaptor.getType())).containsSame(adaptor));
        }
    }

    @Test
    void everyAdaptorTypeHasExactlyOneBean() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.scan("com.cricketlegend.service.adaptor");
            context.refresh();

            Map<AdaptorType, Long> perType = context.getBeansOfType(Adaptor.class).values().stream()
                    .collect(Collectors.groupingBy(Adaptor::getType, Collectors.counting()));

            for (AdaptorType type : AdaptorType.values()) {
                assertThat(perType).as("beans of type " + type).containsEntry(type, 1L);
            }
        }
    }

    @Test
    void everyAdaptorTypeHasExactlyOneJsonSubTypeEntryNamedAfterIt() {
        JsonSubTypes subTypes = AbstractAdaptor.class.getAnnotation(JsonSubTypes.class);

        List<String> names = Arrays.stream(subTypes.value()).map(JsonSubTypes.Type::name).toList();

        assertThat(names).containsExactlyInAnyOrderElementsOf(
                Arrays.stream(AdaptorType.values()).map(Enum::name).toList());
        assertThat(names).doesNotHaveDuplicates();
        for (JsonSubTypes.Type type : subTypes.value()) {
            assertThat(Adaptor.class).isAssignableFrom(type.value());
            assertThat(type.value().getSuperclass()).isEqualTo(AbstractAdaptor.class);
        }
    }

    @Test
    void twoAdaptorsOfOneTypeFailAtStartUpNamingBoth() {
        TestAdaptor first = testAdaptor("a", Set.of(ImportInputFormat.JSON));
        TestAdaptor second = testAdaptor("b", Set.of(ImportInputFormat.JSON));

        assertThatThrownBy(() -> new AdaptorRegistry(List.of(first, second)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JSON")
                .hasMessageContaining(TestAdaptor.class.getName());
    }

    @Test
    void allIsSortedByDisplayNameAndFindIsEmptyForAMissingType() {
        AdaptorRegistry registry = new AdaptorRegistry(List.of(new JsonAdaptor()));
        AdaptorRegistry empty = new AdaptorRegistry(List.of());

        assertThat(registry.all()).extracting(Adaptor::getDisplayName).containsExactly("Cricket Legend JSON");
        assertThat(empty.all()).isEmpty();
        assertThat(empty.find(AdaptorType.JSON)).isEmpty();
    }

    // ---- Jackson ----

    @Test
    void theTypeRoundTripsThroughJackson() throws Exception {
        for (AdaptorType type : AdaptorType.values()) {
            assertThat(json.readValue(json.writeValueAsString(type), AdaptorType.class)).isEqualTo(type);
        }
        JsonNode tree = json.readTree(json.writeValueAsString(new JsonAdaptor()));

        assertThat(tree.get("type").asText()).isEqualTo("JSON");
    }

    @Test
    void aDescriptorShapedPayloadDeserialisesToTheRightSubtype() throws Exception {
        String descriptorShaped = """
                {"type":"JSON","displayName":"Whatever","description":"x","aiAllowed":true,"unknownField":1,
                 "supportedFormats":["JSON"],"example":"e","conversionPrompt":"p"}""";

        AbstractAdaptor read = json.readValue(descriptorShaped, AbstractAdaptor.class);

        assertThat(read).isInstanceOf(JsonAdaptor.class);
        assertThat(read.getType()).isEqualTo(AdaptorType.JSON);
        // read-only descriptive properties are not taken from the payload
        assertThat(read.getDisplayName()).isEqualTo("Cricket Legend JSON");
        assertThat(read.isAiAllowed()).isFalse();
    }

    @Test
    void theSerialisedFormCarriesOnlyTheDescriptiveGettersNotBehaviour() throws Exception {
        JsonNode tree = json.readTree(json.writeValueAsString(new JsonAdaptor()));

        assertThat(tree.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "type", "displayName", "description", "supportedFormats", "aiAllowed", "example", "conversionPrompt");
    }

    // ---- the descriptor ----

    @Test
    void theDescriptorOfTheJsonAdaptorHasEverythingTheUiNeeds() {
        JsonAdaptor adaptor = new JsonAdaptor();

        AdaptorDescriptorDto descriptor = mapper.toDescriptor(adaptor);

        assertThat(descriptor.type()).isEqualTo(AdaptorType.JSON);
        assertThat(descriptor.displayName()).isEqualTo(adaptor.getDisplayName());
        assertThat(descriptor.description()).isEqualTo(adaptor.getDescription());
        assertThat(descriptor.aiAllowed()).isFalse();
        assertThat(descriptor.example()).isEqualTo(adaptor.getExample()).isNotBlank();
        assertThat(descriptor.conversionPrompt()).isEqualTo(adaptor.getConversionPrompt()).isNotBlank();
        assertThat(descriptor.inputs()).singleElement().satisfies(input -> {
            assertThat(input.format()).isEqualTo(ImportInputFormat.JSON);
            assertThat(input.textBased()).isTrue();
            assertThat(input.acceptsPaste()).isTrue();
            assertThat(input.extensions()).containsExactly(".json");
            assertThat(input.maxBytes()).isEqualTo(ResultImportLimits.TEXT_FILE_MAX_BYTES);
        });
    }

    @Test
    void formatsAreFlaggedTextBasedOrBinaryAndPasteIsOnlyOfferedForText() {
        TestAdaptor mixed = testAdaptor("mixed", Set.of(ImportInputFormat.PDF, ImportInputFormat.CSV, ImportInputFormat.EXCEL));

        List<InputFormatDto> inputs = mapper.toDescriptor(mixed).inputs();

        assertThat(inputs).extracting(InputFormatDto::format)
                .containsExactly(ImportInputFormat.CSV, ImportInputFormat.EXCEL, ImportInputFormat.PDF);
        assertThat(inputs).filteredOn(i -> i.format() == ImportInputFormat.CSV).singleElement().satisfies(i -> {
            assertThat(i.textBased()).isTrue();
            assertThat(i.acceptsPaste()).isTrue();
        });
        assertThat(inputs).filteredOn(i -> i.format() != ImportInputFormat.CSV).allSatisfy(i -> {
            assertThat(i.textBased()).isFalse();
            assertThat(i.acceptsPaste()).isFalse();
            assertThat(i.maxBytes()).isEqualTo(ResultImportLimits.BINARY_FILE_MAX_BYTES);
        });
        assertThat(inputs).filteredOn(i -> i.format() == ImportInputFormat.EXCEL).singleElement()
                .extracting(InputFormatDto::extensions).isEqualTo(List.of(".xlsx", ".xls"));
    }

    @Test
    void theLimitsCarryTheSingleSourceOfTheCaps() {
        ImportLimitsDto limits = ImportLimitsDto.current();

        assertThat(limits.maxPasteCharacters()).isEqualTo(ResultImportLimits.MAX_PASTE_CHARACTERS);
        assertThat(limits.maxFileBytes()).isEqualTo(ResultImportLimits.GLOBAL_MAX_FILE_BYTES);
        assertThat(limits.maxPlayersPerSide()).isEqualTo(30);
        assertThat(limits.maxRegularInnings()).isEqualTo(2);
        assertThat(limits.maxNameLength()).isEqualTo(100);
        assertThat(limits.maxReportedErrors()).isEqualTo(50);
    }
}
