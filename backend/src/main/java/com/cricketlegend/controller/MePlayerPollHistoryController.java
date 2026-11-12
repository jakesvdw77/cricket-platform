package com.cricketlegend.controller;

import com.cricketlegend.dto.MyClosedPollsDto;
import com.cricketlegend.dto.MyPollResponsesDto;
import com.cricketlegend.service.MyPlayerPollHistoryService;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/119, Hub Availability pills Closed Polls and My Responses: read-only, authorised only from the caller's own
 * held player (404 for any other key), like {@code MePlayersController}.
 */
@RestController
@RequestMapping("/api/v1/me/players")
class MePlayerPollHistoryController {

    private final MyPlayerPollHistoryService historyService;

    MePlayerPollHistoryController(MyPlayerPollHistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping("/{playerKey}/polls/closed")
    MyClosedPollsDto closed(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) Integer sinceDays,
            @RequestParam(required = false) String status) {
        return historyService.closed(authentication, playerKey, sinceDays, status);
    }

    @GetMapping("/{playerKey}/polls/responses")
    MyPollResponsesDto responses(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) String status) {
        return historyService.responses(authentication, playerKey, seasonId, status);
    }
}
