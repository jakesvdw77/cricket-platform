package com.cricketlegend.mapper;

import com.cricketlegend.dto.TeamStatsDto.TeamStatsBatting;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsBowling;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsChase;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsChasing;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsExtras;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsExtrasComponentCoverage;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsExtrasCoverage;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsExtrasTotalCoverage;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsFormEntry;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsInningsTotal;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsNetRunRate;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsNotCaptured;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageBasis;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsRecord;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsVictoryByRuns;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsVictoryByWickets;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsColumnInfo;
import com.cricketlegend.service.support.TeamStatsCalculator;
import com.cricketlegend.service.support.TeamStatsColumn;
import com.cricketlegend.service.support.TeamStatsFactsReader.FormFact;
import com.cricketlegend.service.support.TeamStatsFactsReader.MatchRef;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * docs/specs/116-team-stats.md: the team table's columns and the team page's calculator figures as their API shape. Enums
 * map to their names. A figure is never changed here; the match references only add the match line to a figure that the
 * calculator already decoded.
 */
@Mapper(componentModel = "spring")
public interface TeamStatsMapper {

    @Mapping(target = "sortable", constant = "true")
    TeamStatsColumnInfo toColumnInfo(TeamStatsColumn column);

    @Mapping(
            target = "forfeits",
            expression = "java(new com.cricketlegend.dto.TeamStatsDto.TeamStatsForfeits("
                    + "basis.forfeitsReceived(), basis.forfeitsConceded()))")
    TeamStatsPageBasis toPageBasis(TeamStatsCalculator.Basis basis);

    TeamStatsRecord toRecord(TeamStatsCalculator.Record value);

    TeamStatsFormEntry toFormEntry(FormFact fact);

    List<TeamStatsFormEntry> toFormEntries(List<FormFact> facts);

    @Mapping(target = "highestTotal", expression = "java(toTotal(batting.highestTotal(), highestRef))")
    @Mapping(target = "lowestTotal", expression = "java(toTotal(batting.lowestTotal(), lowestRef))")
    TeamStatsBatting toBatting(TeamStatsCalculator.Batting batting, MatchRef highestRef, MatchRef lowestRef);

    TeamStatsInningsTotal toTotal(TeamStatsCalculator.Total total, MatchRef ref);

    @Mapping(target = "highestSuccessfulChase", expression = "java(toChase(chasing.highestSuccessfulChase(), chaseRef))")
    @Mapping(
            target = "largestVictoryByRuns",
            expression = "java(toVictoryByRuns(chasing.largestVictoryByRuns(), victoryRunsRef))")
    @Mapping(
            target = "largestVictoryByWickets",
            expression = "java(toVictoryByWickets(chasing.largestVictoryByWickets(), victoryWicketsRef))")
    TeamStatsChasing toChasing(
            TeamStatsCalculator.Chasing chasing,
            MatchRef chaseRef,
            MatchRef victoryRunsRef,
            MatchRef victoryWicketsRef);

    TeamStatsChase toChase(TeamStatsCalculator.Chase chase, MatchRef ref);

    TeamStatsVictoryByRuns toVictoryByRuns(TeamStatsCalculator.VictoryByRuns victory, MatchRef ref);

    TeamStatsVictoryByWickets toVictoryByWickets(TeamStatsCalculator.VictoryByWickets victory, MatchRef ref);

    TeamStatsBowling toBowling(TeamStatsCalculator.Bowling bowling);

    @Mapping(target = "wides", source = "wides.value")
    @Mapping(target = "noBalls", source = "noBalls.value")
    @Mapping(target = "byes", source = "byes.value")
    @Mapping(target = "legByes", source = "legByes.value")
    @Mapping(target = "penaltyRuns", source = "penaltyRuns.value")
    @Mapping(target = "coverage", source = "total")
    @Mapping(target = "componentCoverage", source = ".")
    TeamStatsExtras toExtras(TeamStatsCalculator.Extras extras);

    TeamStatsExtrasComponentCoverage toComponentCoverage(TeamStatsCalculator.Extras extras);

    @Mapping(target = "inningsWithExtras", source = "inningsRecorded")
    TeamStatsExtrasTotalCoverage toExtrasTotalCoverage(TeamStatsCalculator.ExtrasFigure figure);

    TeamStatsExtrasCoverage toExtrasCoverage(TeamStatsCalculator.ExtrasFigure figure);

    TeamStatsNetRunRate toNetRunRate(TeamStatsCalculator.NetRunRate netRunRate);

    List<TeamStatsNotCaptured> toNotCaptured(List<TeamStatsCalculator.NotCaptured> notCaptured);
}
