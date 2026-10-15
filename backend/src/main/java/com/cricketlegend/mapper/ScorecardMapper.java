package com.cricketlegend.mapper;

import com.cricketlegend.domain.BattingEntry;
import com.cricketlegend.domain.BowlingEntry;
import com.cricketlegend.domain.FieldingEntry;
import com.cricketlegend.domain.MatchAward;
import com.cricketlegend.domain.MatchInnings;
import com.cricketlegend.domain.ResultPlayer;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.FieldingEntryDto;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardInningsDto;
import com.cricketlegend.service.support.DismissalCredits;
import java.util.UUID;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

/**
 * docs/specs/101-match-results-our-side-scorecard.md. Stored scorecard rows map to their read DTOs (the innings the row
 * belongs to arrives as its batting side; the suggestion and the effective featured flag are computed by the service
 * and passed in), and incoming DTOs map to new rows. Identity and tenancy (match innings, result, player ids) are
 * always set by the service, never taken from the body; {@code featured} stays null on a draft. docs/specs/104: {@code
 * importMatch} is never mapped from a body: the service sets or clears it explicitly (a client can only keep or clear it).
 */
@Mapper(componentModel = "spring")
public interface ScorecardMapper {

    @Mapping(target = "clientKey", ignore = true)
    ResultPlayerDto toPlayerDto(ResultPlayer player, String firstName, String lastName);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchResultId", ignore = true)
    @Mapping(target = "linkedBy", ignore = true)
    @Mapping(target = "linkedAt", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    @Mapping(target = "importMatch", ignore = true)
    ResultPlayer toPlayerEntity(ResultPlayerDto dto);

    /** Applies an incoming player onto the stored row: who they are, never the link audit or the creation time. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchResultId", ignore = true)
    @Mapping(target = "linkedBy", ignore = true)
    @Mapping(target = "linkedAt", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    @Mapping(target = "importMatch", ignore = true)
    @Mapping(target = "plannedBattingOrder", expression =
            "java(dto.plannedBattingOrder() != null ? dto.plannedBattingOrder() : player.getPlannedBattingOrder())")
    void applyPlayer(ResultPlayerDto dto, @MappingTarget ResultPlayer player);

    @Mapping(target = "id", source = "entry.id")
    @Mapping(target = "battingSide", source = "side")
    @Mapping(target = "inningsKind", constant = "REGULAR")
    @Mapping(target = "playerClientKey", ignore = true)
    @Mapping(target = "bowlerPlayerId", source = "entry.bowlerResultPlayerId")
    @Mapping(target = "fielderPlayerId", source = "entry.fielderResultPlayerId")
    @Mapping(target = "suggested", source = "suggestedFlag")
    @Mapping(target = "featured", source = "effective")
    BattingEntryDto toBattingDto(BattingEntry entry, ResultSide side, Boolean suggestedFlag, Boolean effective);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchInningsId", source = "inningsId")
    @Mapping(target = "resultPlayerId", source = "playerId")
    @Mapping(target = "featured", ignore = true)
    @Mapping(target = "howOut", source = "dto.howOut")
    @Mapping(target = "bowlerResultPlayerId", source = "bowlerId")
    @Mapping(target = "fielderResultPlayerId", source = "fielderId")
    BattingEntry toBattingEntity(BattingEntryDto dto, UUID inningsId, UUID playerId, UUID bowlerId, UUID fielderId);

    @Mapping(target = "id", source = "entry.id")
    @Mapping(target = "battingSide", source = "side")
    @Mapping(target = "inningsKind", constant = "REGULAR")
    @Mapping(target = "playerClientKey", ignore = true)
    @Mapping(target = "suggested", source = "suggestedFlag")
    @Mapping(target = "featured", source = "effective")
    BowlingEntryDto toBowlingDto(
            BowlingEntry entry, ResultSide side, Boolean suggestedFlag, Boolean effective, Integer derivedWickets);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchInningsId", source = "inningsId")
    @Mapping(target = "resultPlayerId", source = "playerId")
    @Mapping(target = "featured", ignore = true)
    @Mapping(target = "balls", source = "dto.balls", defaultValue = "0")
    @Mapping(target = "maidens", source = "dto.maidens", defaultValue = "0")
    @Mapping(target = "runs", source = "dto.runs", defaultValue = "0")
    @Mapping(target = "wickets", source = "dto.wickets", defaultValue = "0")
    @Mapping(target = "wicketsSource", source = "dto.wicketsSource", defaultValue = "MANUAL")
    BowlingEntry toBowlingEntity(BowlingEntryDto dto, UUID inningsId, UUID playerId);

    @Mapping(target = "id", source = "entry.id")
    @Mapping(target = "battingSide", source = "side")
    @Mapping(target = "inningsKind", constant = "REGULAR")
    @Mapping(target = "playerClientKey", ignore = true)
    @Mapping(target = "suggested", source = "suggestedFlag")
    @Mapping(target = "featured", source = "effective")
    @Mapping(target = "catches", source = "entry.catches")
    @Mapping(target = "stumpings", source = "entry.stumpings")
    @Mapping(target = "runOuts", source = "entry.runOuts")
    @Mapping(target = "derivedCatches", source = "derived.catches")
    @Mapping(target = "derivedStumpings", source = "derived.stumpings")
    @Mapping(target = "derivedRunOuts", source = "derived.runOuts")
    FieldingEntryDto toFieldingDto(
            FieldingEntry entry, ResultSide side, Boolean suggestedFlag, Boolean effective, DismissalCredits.Credit derived);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchInningsId", source = "inningsId")
    @Mapping(target = "resultPlayerId", source = "playerId")
    @Mapping(target = "featured", ignore = true)
    @Mapping(target = "catches", source = "dto.catches", defaultValue = "0")
    @Mapping(target = "stumpings", source = "dto.stumpings", defaultValue = "0")
    @Mapping(target = "runOuts", source = "dto.runOuts", defaultValue = "0")
    @Mapping(target = "creditsSource", source = "dto.creditsSource", defaultValue = "MANUAL")
    FieldingEntry toFieldingEntity(FieldingEntryDto dto, UUID inningsId, UUID playerId);

    @Mapping(target = "playerClientKey", ignore = true)
    @Mapping(target = "playerName", source = "playerName")
    MatchAwardDto toAwardDto(MatchAward award, String playerName);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "matchResultId", source = "resultId")
    @Mapping(target = "resultPlayerId", source = "playerId")
    MatchAward toAwardEntity(MatchAwardDto dto, UUID resultId, UUID playerId);

    @Mapping(target = "extras", source = "innings.extras")
    ScorecardInningsDto toInningsDto(MatchInnings innings, boolean nonBowlerWicketsDerived);
}
