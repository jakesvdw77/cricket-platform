package com.cricketlegend.controller;

import com.cricketlegend.dto.InviteAgentRequest;
import com.cricketlegend.dto.MyFieldDto;
import com.cricketlegend.dto.MyLeagueDto;
import com.cricketlegend.dto.MyLeaguesDto;
import com.cricketlegend.dto.MyPlayerDto;
import com.cricketlegend.dto.MyPlayerSummaryDto;
import com.cricketlegend.dto.MyPollDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.UpdateMyPlayerRequest;
import com.cricketlegend.service.AgentInvitationService;
import com.cricketlegend.service.MyFieldService;
import com.cricketlegend.service.MyLeagueService;
import com.cricketlegend.service.MyPlayerPollService;
import com.cricketlegend.service.MyPlayerService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/119, "My players": authenticated, authorised only from the caller's own ACTIVE person links and own verified
 * player record (no role, no club scope). A key the caller does not hold is a 404.
 */
@RestController
@RequestMapping("/api/v1/me/players")
class MePlayersController {

    private final MyPlayerService myPlayerService;
    private final MyPlayerPollService myPlayerPollService;
    private final AgentInvitationService agentInvitationService;
    private final MyFieldService myFieldService;
    private final MyLeagueService myLeagueService;

    MePlayersController(
            MyPlayerService myPlayerService,
            MyPlayerPollService myPlayerPollService,
            AgentInvitationService agentInvitationService,
            MyFieldService myFieldService,
            MyLeagueService myLeagueService) {
        this.myPlayerService = myPlayerService;
        this.myPlayerPollService = myPlayerPollService;
        this.agentInvitationService = agentInvitationService;
        this.myFieldService = myFieldService;
        this.myLeagueService = myLeagueService;
    }

    // Write endpoints below: MyPlayerAccess (inside the services) is the only authorisation gate, from the caller's own rows.
    @PostMapping("/{playerKey}/agents")
    ResponseEntity<Void> inviteAgent(
            Authentication authentication,
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String playerKey,
            @Valid @RequestBody InviteAgentRequest request) {
        agentInvitationService.invite(authentication, jwt, playerKey, request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    List<MyPlayerSummaryDto> list(Authentication authentication) {
        return myPlayerService.list(authentication);
    }

    @GetMapping("/{playerKey}")
    MyPlayerDto get(Authentication authentication, @PathVariable String playerKey) {
        return myPlayerService.get(authentication, playerKey);
    }

    @PutMapping("/{playerKey}")
    MyPlayerDto update(
            Authentication authentication, @PathVariable String playerKey, @Valid @RequestBody UpdateMyPlayerRequest request) {
        return myPlayerService.update(authentication, playerKey, request);
    }

    @GetMapping("/{playerKey}/polls")
    List<MyPollDto> polls(Authentication authentication, @PathVariable String playerKey) {
        return myPlayerPollService.list(authentication, playerKey);
    }

    /** docs/specs/121: the Field Directory, read-only, authorised only through MyPlayerAccess in the service. */
    @GetMapping("/{playerKey}/fields")
    List<MyFieldDto> fields(Authentication authentication, @PathVariable String playerKey) {
        return myFieldService.list(authentication, playerKey);
    }

    /** docs/specs/123: the leagues the held player's teams play in, read-only, authorised only through MyPlayerAccess. */
    @GetMapping("/{playerKey}/leagues")
    MyLeaguesDto leagues(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID seasonId) {
        return myLeagueService.list(authentication, playerKey, seasonId);
    }

    /** docs/specs/123: one of those leagues; a 404 when the player's teams are not in it for the season. */
    @GetMapping("/{playerKey}/leagues/{leagueId}")
    MyLeagueDto league(
            Authentication authentication,
            @PathVariable String playerKey,
            @PathVariable UUID leagueId,
            @RequestParam(required = false) UUID seasonId) {
        return myLeagueService.get(authentication, playerKey, leagueId, seasonId);
    }

    @PutMapping("/{playerKey}/polls/{pollId}/answers")
    PublicAnswersDto saveAnswers(
            Authentication authentication,
            @PathVariable String playerKey,
            @PathVariable UUID pollId,
            @Valid @RequestBody PublicAnswersRequest request) {
        return myPlayerPollService.saveAnswers(authentication, playerKey, pollId, request);
    }
}
