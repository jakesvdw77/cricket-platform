package com.cricketlegend.mapper;

import com.cricketlegend.dto.AdaptorDescriptorDto;
import com.cricketlegend.dto.InputFormatDto;
import com.cricketlegend.service.adaptor.Adaptor;
import com.cricketlegend.service.adaptor.ImportInputFormat;
import java.util.Comparator;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * docs/specs/104-match-results-import-adaptors.md: an {@link Adaptor} bean to its plain descriptor for the discovery
 * endpoint. Reads only the adaptor's own descriptive members.
 */
@Mapper(componentModel = "spring")
public interface AdaptorMapper {

    @Mapping(target = "inputs", expression = "java(inputsOf(adaptor))")
    AdaptorDescriptorDto toDescriptor(Adaptor adaptor);

    @Mapping(target = "format", source = "format")
    @Mapping(target = "textBased", source = "format.textBased")
    @Mapping(target = "extensions", source = "format.extensions")
    @Mapping(target = "acceptsPaste", source = "format.textBased")
    @Mapping(target = "maxBytes", expression = "java(adaptor.maxBytes(format))")
    InputFormatDto toInput(ImportInputFormat format, Adaptor adaptor);

    default List<InputFormatDto> inputsOf(Adaptor adaptor) {
        return adaptor.getSupportedFormats().stream()
                .sorted(Comparator.naturalOrder())
                .map(format -> toInput(format, adaptor))
                .toList();
    }
}
