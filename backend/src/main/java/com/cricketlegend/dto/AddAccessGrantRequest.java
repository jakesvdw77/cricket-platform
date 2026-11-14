package com.cricketlegend.dto;

import com.cricketlegend.domain.ScopeType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Per docs/specs/150. {@code scope} is CLUB or SECTION; {@code sectionId} is required for SECTION and must be absent for CLUB. */
public record AddAccessGrantRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @NotNull UUID roleId,
        @NotNull ScopeType scope,
        UUID sectionId) {}
