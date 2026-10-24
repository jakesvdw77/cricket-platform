package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubOptionDto;
import com.cricketlegend.dto.CreateLinkRequestRequest;
import com.cricketlegend.dto.LinkRequestReceivedDto;
import com.cricketlegend.dto.MyLinkRequestDto;
import com.cricketlegend.dto.SectionOptionDto;
import com.cricketlegend.service.ClubSearchService;
import com.cricketlegend.service.MyLinkRequestService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/119: the requester's link requests and the club picker. Any authenticated caller; creating a request needs a
 * verified email and always answers the same way.
 */
@RestController
@RequestMapping("/api/v1/me")
class MeLinkRequestsController {

    private final MyLinkRequestService myLinkRequestService;
    private final ClubSearchService clubSearchService;

    MeLinkRequestsController(MyLinkRequestService myLinkRequestService, ClubSearchService clubSearchService) {
        this.myLinkRequestService = myLinkRequestService;
        this.clubSearchService = clubSearchService;
    }

    @GetMapping("/clubs")
    List<ClubOptionDto> clubs() {
        return clubSearchService.listActiveOptions();
    }

    @GetMapping("/clubs/{clubId}/sections")
    List<SectionOptionDto> sections(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID clubId) {
        return myLinkRequestService.sectionOptions(jwt, clubId);
    }

    @PostMapping("/link-requests")
    LinkRequestReceivedDto create(
            Authentication authentication, @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateLinkRequestRequest request) {
        return myLinkRequestService.create(authentication, jwt, request);
    }

    @GetMapping("/link-requests")
    List<MyLinkRequestDto> list(Authentication authentication) {
        return myLinkRequestService.list(authentication);
    }

    @DeleteMapping("/link-requests/{id}")
    ResponseEntity<Void> cancel(Authentication authentication, @PathVariable UUID id) {
        myLinkRequestService.cancel(authentication, id);
        return ResponseEntity.noContent().build();
    }
}
