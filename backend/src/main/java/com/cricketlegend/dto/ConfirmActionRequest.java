package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;

/** A body that only carries the explicit server-enforced {@code confirm: true} (docs/specs/119, slice 4). */
public record ConfirmActionRequest(@NotNull Boolean confirm) {}
