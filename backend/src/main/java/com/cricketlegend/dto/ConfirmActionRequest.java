package com.cricketlegend.dto;

/** A body that only carries the explicit server-enforced {@code confirm: true} (docs/specs/119, slice 4). */
public record ConfirmActionRequest(Boolean confirm) {}
