package com.cricketlegend.dto;

import com.cricketlegend.domain.ScopeType;
import java.time.Instant;
import java.util.UUID;

/**
 * One person's role at one place, per docs/specs/150. {@code status} is ACTIVE or INVITED (the person has never signed in).
 * {@code canChange}, {@code canRemove} and {@code canResend} are what the server would allow this caller, so the screen never
 * offers an action the server refuses.
 */
public record AccessGrantDto(
        UUID id,
        UUID personId,
        String firstName,
        String lastName,
        String email,
        UUID roleId,
        String roleName,
        ScopeType scopeType,
        UUID sectionId,
        String sectionName,
        String status,
        String addedByName,
        Instant invitationSentAt,
        boolean self,
        boolean canChange,
        boolean canRemove,
        boolean canResend) {}
