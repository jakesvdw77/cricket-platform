package com.cricketlegend.controller;

import com.cricketlegend.dto.InviteAgentRequest;
import com.cricketlegend.dto.MyFieldDto;
import com.cricketlegend.dto.MyLeagueDto;
import com.cricketlegend.dto.MyLeaguesDto;
import com.cricketlegend.dto.MyMatchDto;
import com.cricketlegend.dto.MyMatchListDto;
import com.cricketlegend.dto.MyPlayerDto;
import com.cricketlegend.dto.MyPlayerSummaryDto;
import com.cricketlegend.dto.MyPollDto;
import com.cricketlegend.dto.MyResultDto;
import com.cricketlegend.dto.MyResultFiltersDto;
import com.cricketlegend.dto.MyResultListDto;
import com.cricketlegend.dto.MyResultSummaryDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.UpdateMyPlayerRequest;
import com.cricketlegend.service.AgentInvitationService;
import com.cricketlegend.service.MyFieldService;
import com.cricketlegend.service.MyLeagueService;
import com.cricketlegend.service.MyMatchService;
import com.cricketlegend.service.MyPlayerPollService;
import com.cricketlegend.service.MyPlayerService;
import com.cricketlegend.service.MyResultService;
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
    private final MyMatchService myMatchService;
    private final MyResultService myResultService;

    MePlayersController(
            MyPlayerService myPlayerService,
            MyPlayerPollService myPlayerPollService,
            AgentInvitationService agentInvitationService,
            MyFieldService myFieldService,
            MyLeagueService myLeagueService,
            MyMatchService myMatchService,
            MyResultService myResultService) {
        this.myPlayerService = myPlayerService;
        this.myPlayerPollService = myPlayerPollService;
        this.agentInvitationService = agentInvitationService;
        this.myFieldService = myFieldService;
        this.myLeagueService = myLeagueService;
        this.myMatchService = myMatchService;
        this.myResultService = myResultService;
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

    /** docs/specs/135: the held player's live, upcoming and recent matches, authorised only through MyPlayerAccess. */
    @GetMapping("/{playerKey}/matches")
    MyMatchListDto matches(Authentication authentication, @PathVariable String playerKey) {
        return myMatchService.list(authentication, playerKey);
    }

    /** docs/specs/135: one match; a 404 when it is not a match of the held player's teams. */
    @GetMapping("/{playerKey}/matches/{matchId}")
    MyMatchDto match(Authentication authentication, @PathVariable String playerKey, @PathVariable UUID matchId) {
        return myMatchService.get(authentication, playerKey, matchId);
    }

    /**
     * docs/specs/145: the held player's counted results that a manager switched on for the Player Hub, newest first,
     * authorised only through MyPlayerAccess. {@code page} defaults to 0 and {@code size} to 20 (1 to 100).
     */
    @GetMapping("/{playerKey}/results")
    MyResultListDto results(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) String competition,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return myResultService.list(authentication, playerKey, seasonId, teamId, leagueId, competition, page, size);
    }

    /** docs/specs/145: the Results hero figures and the newest five rows for the same scope. */
    @GetMapping("/{playerKey}/results/summary")
    MyResultSummaryDto resultsSummary(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) String competition) {
        return myResultService.summary(authentication, playerKey, seasonId, teamId, leagueId, competition);
    }

    /** docs/specs/145: the Season, Team and League values the held player has shown results for. */
    @GetMapping("/{playerKey}/results/filters")
    MyResultFiltersDto resultsFilters(Authentication authentication, @PathVariable String playerKey) {
        return myResultService.filters(authentication, playerKey);
    }

    /** docs/specs/145: one result with the full scorecard; a 404 when it is not one of the held player's shown results. */
    @GetMapping("/{playerKey}/results/{matchId}")
    MyResultDto result(Authentication authentication, @PathVariable String playerKey, @PathVariable UUID matchId) {
        return myResultService.get(authentication, playerKey, matchId);
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
