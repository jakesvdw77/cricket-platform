package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubSummaryDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.service.ClubSearchService;
import com.cricketlegend.service.support.PublicClubLookupLimiter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/004-landing-page.md's "find your club" login step — public, typeahead search over
 * ACTIVE clubs only. Never returns branding/membership detail.
 */
@RestController
public class PublicClubController {

    private final ClubSearchService clubSearchService;

    private final PublicClubLookupLimiter lookupLimiter;

    public PublicClubController(ClubSearchService clubSearchService, PublicClubLookupLimiter lookupLimiter) {
        this.clubSearchService = clubSearchService;
        this.lookupLimiter = lookupLimiter;
    }

    @GetMapping("/api/v1/public/clubs")
    public ResponseEntity<List<ClubSummaryDto>> search(
            @RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(clubSearchService.search(query));
    }

    /** docs/specs/149: one ACTIVE club by slug; unknown, inactive and malformed slugs are one identical 404. */
    @GetMapping("/api/v1/public/clubs/by-slug/{slug}")
    public ResponseEntity<ClubSummaryDto> findBySlug(@PathVariable String slug, HttpServletRequest http) {
        lookupLimiter.checkAllowed(http.getRemoteAddr());
        return ResponseEntity.ok(
                clubSearchService.findActiveBySlug(slug).orElseThrow(() -> new NotFoundException("Club not found")));
    }
}
