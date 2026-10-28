package com.cricketlegend.mapper;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MyLeagueInfoDto;
import com.cricketlegend.dto.MyLeagueSeasonDto;
import com.cricketlegend.dto.MyLeagueTeamDto;
import com.cricketlegend.dto.MyPlayingConditionsDto;
import com.cricketlegend.dto.MySeasonOptionDto;
import com.cricketlegend.dto.MyTeamRefDto;
import com.cricketlegend.dto.SocialLinkDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * docs/specs/123: entities to the Player Hub league shapes. Each target lists only what a linked account may see, so a
 * field added to an entity later never leaks by inference (no contacts, phone, email, audit or active fields).
 */
@Mapper(componentModel = "spring")
public interface MyLeagueMapper {

    MyLeagueInfoDto toInfo(League league);

    SocialLinkDto toDto(SocialLink socialLink);

    @Mapping(target = "name", source = "label")
    MyLeagueSeasonDto toSeason(Season season);

    @Mapping(target = "id", source = "season.id")
    @Mapping(target = "name", source = "season.label")
    @Mapping(target = "current", source = "current")
    MySeasonOptionDto toOption(Season season, boolean current);

    MyPlayingConditionsDto toConditions(LeaguePlayingConditions conditions);

    MyTeamRefDto toRef(Team team);

    @Mapping(target = "id", source = "team.id")
    @Mapping(target = "name", source = "team.name")
    @Mapping(target = "abbreviation", source = "team.abbreviation")
    @Mapping(target = "logoUrl", source = "team.logoUrl")
    @Mapping(target = "mine", source = "mine")
    MyLeagueTeamDto toTeam(Team team, boolean mine);

    @Mapping(target = "id", source = "team.id")
    @Mapping(target = "name", source = "team.name")
    @Mapping(target = "abbreviation", source = "team.abbreviation")
    @Mapping(target = "logoUrl", source = "team.logoUrl")
    @Mapping(target = "mine", source = "mine")
    MyLeagueTeamDto toTeam(LeagueTeam team, boolean mine);
}
