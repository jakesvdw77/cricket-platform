package com.cricketlegend.mapper;

import com.cricketlegend.domain.MatchInnings;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.ResultDraft;
import java.util.List;
import org.mapstruct.Context;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

/**
 * docs/specs/100-match-results-core.md. A stored result maps to its read DTO (with display overs derived from balls and
 * the result's own {@code ballsPerOver}), to the canonical {@link ResultDraft} (so stored and incoming results share
 * one validator), and a draft is applied onto an entity. Identity, tenancy, status, source and publish fields are never
 * touched by a draft.
 */
@Mapper(componentModel = "spring")
public interface MatchResultMapper {

    @Mapping(target = "playingAreaName", ignore = true)
    @Mapping(target = "innings", expression = "java(toInningsDtos(innings, result.getBallsPerOver()))")
    MatchResultDto toDto(MatchResult result, List<MatchInnings> innings);

    @Mapping(target = "innings", expression = "java(toInningsDtos(innings, result.getBallsPerOver()))")
    ResultDraft toDraft(MatchResult result, List<MatchInnings> innings);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "clubId", ignore = true)
    @Mapping(target = "matchId", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "detailLevel", ignore = true)
    @Mapping(target = "source", ignore = true)
    @Mapping(target = "externalId", ignore = true)
    @Mapping(target = "sourcePayload", ignore = true)
    @Mapping(target = "publishedAt", ignore = true)
    @Mapping(target = "publishedBy", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    void applyDraft(ResultDraft draft, @MappingTarget MatchResult result);

    @Mapping(target = "oversDisplay", expression = "java(com.cricketlegend.service.support.OversFormat.display(innings.getBalls(), ballsPerOver))")
    InningsDto toInningsDto(MatchInnings innings, @Context int ballsPerOver);

    default List<InningsDto> toInningsDtos(List<MatchInnings> innings, int ballsPerOver) {
        return innings.stream().map(i -> toInningsDto(i, ballsPerOver)).toList();
    }

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchResultId", ignore = true)
    MatchInnings toInningsEntity(InningsDto dto);
}
