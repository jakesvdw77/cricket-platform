package com.cricketlegend.controller;

import com.cricketlegend.dto.MyTeamLinksDto;
import com.cricketlegend.service.MyTeamLinksService;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Hub Social Media (docs/specs/157): the social links of the teams a held player is in, authorised only from the caller's own
 * held player (404 for any other key), like {@code MePlayerClubInfoController}. {@code Cache-Control: private, no-store}.
 */
@RestController
@RequestMapping("/api/v1/me/players")
class MePlayerTeamLinksController {

    private final MyTeamLinksService teamLinksService;

    MePlayerTeamLinksController(MyTeamLinksService teamLinksService) {
        this.teamLinksService = teamLinksService;
    }

    @GetMapping("/{playerKey}/team-links")
    ResponseEntity<List<MyTeamLinksDto>> teamLinks(Authentication authentication, @PathVariable String playerKey) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(teamLinksService.teamLinks(authentication, playerKey));
    }
}
