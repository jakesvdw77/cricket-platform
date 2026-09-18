package com.cricketlegend.service;

import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import java.util.List;
import java.util.UUID;

/**
 * The season-scoped squad lookup shared by both {@link MatchAvailabilityPollService} and {@link
 * PublicAvailabilityPollService} — queries {@code TeamSquadMemberRepository} directly (mirroring
 * {@code TeamSquadServiceImpl}'s own private {@code toSquadMemberDto} lookup pattern) rather than
 * going through {@code TeamSquadService.list}, whose {@code findTeamOrThrowForClub} would
 * incorrectly 404 the legitimate case where a poll's {@code teamId} belongs to a different club
 * than the match's own managing {@code clubId} (the same cross-club-Team allowance
 * docs/specs/029-league-management.md already established for playing-XI building). See
 * docs/specs/032-match-availability-polls.md.
 */
public interface AvailabilityPollSquadResolver {

    /**
     * Every {@code TeamSquadMember} for {@code teamId}+{@code seasonId}, each mapped to a {@link
     * PlayerAvailabilityRowDto} with {@code status} always {@code null} — callers overlay the
     * actual {@code PlayerAvailability} status for their own poll on top of this shared shape.
     */
    List<PlayerAvailabilityRowDto> resolveSquadRows(UUID teamId, UUID seasonId);
}
