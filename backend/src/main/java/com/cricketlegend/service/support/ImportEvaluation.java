package com.cricketlegend.service.support;

import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.dto.ImportRowDto;
import com.cricketlegend.dto.PlannedChangeDto;
import com.cricketlegend.dto.ReferenceProposalDto;
import java.util.List;
import java.util.Map;

/** The result of validating an import with the manager's decisions applied (spec 097); held by the import service. */
public record ImportEvaluation(
        List<ImportRowDto> rows,
        List<ImportIssueDto> issues,
        List<ReferenceProposalDto> proposals,
        List<PlannedChangeDto> planned,
        Map<String, Object> counts,
        EffectiveImport effective) {
}
