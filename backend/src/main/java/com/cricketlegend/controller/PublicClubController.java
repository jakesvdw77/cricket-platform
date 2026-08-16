package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.service.ClubSearchService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/004-landing-page.md's "find your club" login step — public, typeahead search over
 * ACTIVE clubs only. Never returns branding/membership detail.
 */
@RestController
public class PublicClubController {

    private final ClubSearchService clubSearchService;

    public PublicClubController(ClubSearchService clubSearchService) {
        this.clubSearchService = clubSearchService;
    }

    @GetMapping("/api/v1/public/clubs")
    public ResponseEntity<List<ClubSummaryDto>> search(
            @RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(clubSearchService.search(query));
    }
}
