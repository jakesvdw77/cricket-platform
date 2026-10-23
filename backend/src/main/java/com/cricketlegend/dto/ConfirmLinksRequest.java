package com.cricketlegend.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/** {@code POST /api/v1/me/links}: {@code confirm} must be {@code true}; each ref must come from the caller's own matches. */
public record ConfirmLinksRequest(
        @NotEmpty @Size(max = 50) List<String> playerRefs, Boolean confirm) {}
