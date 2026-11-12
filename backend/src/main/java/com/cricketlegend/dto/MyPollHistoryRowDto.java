package com.cricketlegend.dto;

import com.cricketlegend.domain.MyPollKind;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * One availability poll (open or closed) the held player belongs to, read only (docs/specs/119, Hub Availability pills).
 * {@code pollId} is the squad poll id or the round id. For a SQUAD poll {@code matchDate}, {@code homeName}, {@code
 * awayName}, {@code venue} are set, {@code teamName} is the poll's team and {@code windowDate} is empty; for a GROUP poll
 * those match fields are null, {@code teamName} is the section name and {@code windowDate} lists the window dates covered.
 * {@code closedAt} is null while open. {@code answered} is true when the player gave at least one answer. {@code selected}
 * is true or false only for a squad poll whose side is announced to players, else null.
 */
public record MyPollHistoryRowDto(
        UUID pollId,
        MyPollKind kind,
        String title,
        String teamName,
        Instant matchDate,
        String homeName,
        String awayName,
        String venue,
        List<LocalDate> windowDate,
        boolean open,
        Instant closedAt,
        List<MyPollAnswerDto> answers,
        boolean answered,
        Boolean selected) {
}
