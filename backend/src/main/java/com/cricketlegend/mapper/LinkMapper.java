package com.cricketlegend.mapper;

import com.cricketlegend.dto.PlayerMatchDto;
import com.cricketlegend.dto.PlayerMatchWithMainAgentDto;
import com.cricketlegend.service.support.MaskedEmail;
import com.cricketlegend.service.support.MatchedPlayer;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring")
public interface LinkMapper {

    PlayerMatchDto toDto(MatchedPlayer player);

    List<PlayerMatchDto> toDtos(List<MatchedPlayer> players);

    @Mapping(target = "maskedMainAgentEmail", source = "mainAgentEmail", qualifiedByName = "mask")
    PlayerMatchWithMainAgentDto toWithMainAgentDto(MatchedPlayer player);

    List<PlayerMatchWithMainAgentDto> toWithMainAgentDtos(List<MatchedPlayer> players);

    @Named("mask")
    default String mask(String email) {
        return MaskedEmail.mask(email);
    }
}
