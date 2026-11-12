package com.cricketlegend.service;

import com.cricketlegend.dto.MyClosedPollsDto;
import com.cricketlegend.dto.MyPollResponsesDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * The read-only history behind the Player Hub Availability pills Closed Polls and My Responses (docs/specs/119): the polls
 * the held player belongs to (the membership rule of the open list), with their own answers and, for a squad poll, the
 * selection once the club has announced it. Only the held player's own answers are returned.
 */
public interface MyPlayerPollHistoryService {

    /**
     * Polls that closed in the last {@code sinceDays} days (null means 30; 1 to 365, else 400), newest closed first;
     * {@code status} is an optional {@code MyPollStatusFilter} name (else 400).
     */
    MyClosedPollsDto closed(Authentication authentication, String key, Integer sinceDays, String status);

    /**
     * The held player's answers over one season's polls, open and closed, answered or not (null season means the club's
     * current season; a season of another club is a 404). {@code status} as for {@link #closed}.
     */
    MyPollResponsesDto responses(Authentication authentication, String key, UUID seasonId, String status);
}
