package com.cricketlegend.controller;

import com.cricketlegend.dto.MyClubContactPageDto;
import com.cricketlegend.dto.MyClubInfoDto;
import com.cricketlegend.service.MyClubInfoService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/148-player-hub-club-info.md: the read-only Club info of a held player's club, authorised only from the
 * caller's own held player (404 for any other key), like {@code MePlayersController}. Responses are
 * {@code Cache-Control: private, no-store} because they can carry contact details.
 */
@RestController
@RequestMapping("/api/v1/me/players")
class MePlayerClubInfoController {

    private final MyClubInfoService clubInfoService;

    MePlayerClubInfoController(MyClubInfoService clubInfoService) {
        this.clubInfoService = clubInfoService;
    }

    @GetMapping("/{playerKey}/club-info")
    ResponseEntity<MyClubInfoDto> info(Authentication authentication, @PathVariable String playerKey) {
        return noStore(clubInfoService.info(authentication, playerKey));
    }

    @GetMapping("/{playerKey}/club-info/contacts")
    ResponseEntity<MyClubContactPageDto> contacts(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String letter,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return noStore(clubInfoService.contacts(authentication, playerKey, query, sort, letter, page, size));
    }

    private <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(body);
    }
}
