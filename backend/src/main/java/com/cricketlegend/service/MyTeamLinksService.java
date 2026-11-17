package com.cricketlegend.service;

import com.cricketlegend.dto.MyTeamLinksDto;
import java.util.List;
import org.springframework.security.core.Authentication;

/**
 * The social links of the teams a held player is in (the Player Hub Social Media page). Authorised only from the caller's
 * own held player; empty when the club switched its Hub links off.
 */
public interface MyTeamLinksService {

    List<MyTeamLinksDto> teamLinks(Authentication authentication, String playerKey);
}
