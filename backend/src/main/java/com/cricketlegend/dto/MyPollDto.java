package com.cricketlegend.dto;

import com.cricketlegend.domain.MyPollKind;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * An open availability poll the player belongs to, with their current answers (docs/specs/119). {@code pollId} is the
 * squad poll id or the round id; {@code answers} reuses the 077 shape (windowId null for a squad poll). For a SQUAD
 * poll {@code homeName}, {@code awayName}, {@code matchDate}, {@code venue} and {@code teamName} are set and {@code
 * windows} is empty; for a GROUP poll {@code sectionName} and {@code windows} are set.
 */
public record MyPollDto(
        UUID pollId,
        MyPollKind kind,
        String title,
        String teamName,
        String sectionName,
        String homeName,
        String awayName,
        Instant matchDate,
        String venue,
        Instant scheduledCloseAt,
        List<PublicRoundWindowDto> windows,
        List<PublicAnswerDto> answers) {
}
