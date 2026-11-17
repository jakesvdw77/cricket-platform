package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MyClubSocialLinkDto;
import com.cricketlegend.dto.MyTeamLinksDto;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MyTeamLinksService;
import com.cricketlegend.service.support.ClubInfoRules;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hub Social Media team links (docs/specs/157). The club comes from the resolved held player, never from the request; the
 * club's own "Links" Hub switch (docs/specs/148) also covers team links, so a club that switched links off shows none. Only
 * https links, only teams that have at least one.
 */
@Service
class MyTeamLinksServiceImpl implements MyTeamLinksService {

    private final MyPlayerAccess myPlayerAccess;
    private final ClubProfileRepository clubProfileRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;

    MyTeamLinksServiceImpl(
            MyPlayerAccess myPlayerAccess,
            ClubProfileRepository clubProfileRepository,
            TeamSquadMemberRepository teamSquadMemberRepository) {
        this.myPlayerAccess = myPlayerAccess;
        this.clubProfileRepository = clubProfileRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyTeamLinksDto> teamLinks(Authentication authentication, String playerKey) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        ClubProfile profile = clubProfileRepository.findById(held.profile().getClubId()).orElseGet(ClubProfile::new);
        if (!profile.isHubInfoLinks()) {
            return List.of();
        }
        List<MyTeamLinksDto> result = new ArrayList<>();
        for (Team team : teamSquadMemberRepository.findActiveSeasonTeams(held.profile().getId())) {
            List<MyClubSocialLinkDto> social = new ArrayList<>();
            for (SocialLink link : team.getSocialLinks()) {
                String url = ClubInfoRules.httpsUrl(link.getUrl());
                if (url != null) {
                    social.add(new MyClubSocialLinkDto(ClubInfoRules.blankToNull(link.getPlatform()), url));
                }
            }
            if (!social.isEmpty()) {
                result.add(new MyTeamLinksDto(team.getName(), social));
            }
        }
        return result;
    }
}
