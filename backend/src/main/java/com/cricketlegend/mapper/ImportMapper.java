package com.cricketlegend.mapper;

import com.cricketlegend.domain.ImportBatch;
import com.cricketlegend.dto.ImportBatchDto;
import com.cricketlegend.dto.ImportDecisionsDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.service.support.ImportPayload;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * docs/specs/097-import-framework.md: a batch to its DTO. The stored payload is never exposed raw: only its issues,
 * proposals, planned changes and warnings are copied, rows come through {@code firstRows} (a page the service cut) or
 * the paginated rows endpoint. A null payload (expired, or a history row) gives null lists.
 */
@Mapper(componentModel = "spring")
public interface ImportMapper {

    @Mapping(target = "issues", source = "payload.issues")
    @Mapping(target = "proposals", source = "payload.proposals")
    @Mapping(target = "plannedChanges", source = "payload.plannedChanges")
    @Mapping(target = "fileWarnings", source = "payload.fileWarnings")
    @Mapping(target = "earlierImportWarning", source = "payload.earlierImportWarning")
    @Mapping(target = "decisions", source = "decisions")
    @Mapping(target = "firstRows", source = "firstRows")
    @Mapping(target = "confirmationToken", source = "confirmationToken")
    @Mapping(target = "creationsDigest", source = "creationsDigest")
    ImportBatchDto toDto(
            ImportBatch batch,
            ImportPayload payload,
            ImportDecisionsDto decisions,
            List<ImportRowDto> firstRows,
            String confirmationToken,
            String creationsDigest);
}
