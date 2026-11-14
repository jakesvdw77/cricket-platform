package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Per docs/specs/150: the role changes, the place never does (Remove and Add for that). */
public record ChangeAccessGrantRoleRequest(@NotNull UUID roleId) {}
