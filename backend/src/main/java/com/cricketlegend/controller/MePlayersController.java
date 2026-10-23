package com.cricketlegend.controller;

import com.cricketlegend.dto.MyPlayerDto;
import com.cricketlegend.dto.MyPlayerSummaryDto;
import com.cricketlegend.dto.MyPollDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.UpdateMyPlayerRequest;
import com.cricketlegend.service.MyPlayerPollService;
import com.cricketlegend.service.MyPlayerService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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

    MePlayersController(MyPlayerService myPlayerService, MyPlayerPollService myPlayerPollService) {
        this.myPlayerService = myPlayerService;
        this.myPlayerPollService = myPlayerPollService;
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

    @PutMapping("/{playerKey}/polls/{pollId}/answers")
    PublicAnswersDto saveAnswers(
            Authentication authentication,
            @PathVariable String playerKey,
            @PathVariable UUID pollId,
            @Valid @RequestBody PublicAnswersRequest request) {
        return myPlayerPollService.saveAnswers(authentication, playerKey, pollId, request);
    }
}
