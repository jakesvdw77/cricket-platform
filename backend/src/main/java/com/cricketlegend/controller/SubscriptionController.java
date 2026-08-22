package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateSubscriptionRequest;
import com.cricketlegend.dto.ResendWelcomeEmailResultDto;
import com.cricketlegend.dto.SubscriptionDto;
import com.cricketlegend.dto.UpdateSubscriptionRequest;
import com.cricketlegend.service.SubscriptionService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/009-subscriptions.md: platform_admin-only Subscription CRUD (create, get, paginated
 * list, update, cancel — no hard delete). Authorization for /api/v1/platform/** is enforced by
 * {@link com.cricketlegend.config.SecurityConfig}'s URL-based platform_admin check.
 */
@RestController
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping("/api/v1/platform/subscriptions")
    public ResponseEntity<Page<SubscriptionDto>> list(
            @RequestParam(required = false) String search, Pageable pageable) {
        return ResponseEntity.ok(subscriptionService.list(search, pageable));
    }

    @GetMapping("/api/v1/platform/subscriptions/{id}")
    public ResponseEntity<SubscriptionDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(subscriptionService.get(id));
    }

    @PostMapping("/api/v1/platform/subscriptions")
    @ApiResponse(responseCode = "201", description = "Subscription created")
    public ResponseEntity<SubscriptionDto> create(@Valid @RequestBody CreateSubscriptionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(subscriptionService.create(request));
    }

    @PutMapping("/api/v1/platform/subscriptions/{id}")
    public ResponseEntity<SubscriptionDto> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateSubscriptionRequest request) {
        return ResponseEntity.ok(subscriptionService.update(id, request));
    }

    @PostMapping("/api/v1/platform/subscriptions/{id}/cancel")
    public ResponseEntity<SubscriptionDto> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(subscriptionService.cancel(id));
    }

    @PostMapping("/api/v1/platform/subscriptions/{id}/resend-welcome-email")
    public ResponseEntity<ResendWelcomeEmailResultDto> resendWelcomeEmail(@PathVariable UUID id) {
        return ResponseEntity.ok(subscriptionService.resendWelcomeEmail(id));
    }
}
