package com.cricketlegend.service;

import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.GuestNameDto;
import com.cricketlegend.dto.OppositionNameDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.dto.ScorecardPrefillDto;
import com.cricketlegend.service.support.ScorecardContext;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: the scorecard of a match result, for either side (who played,
 * batting, bowling, fielding, awards; the opposition's players are typed names). The manager-facing methods go through the Matches per-match administrable check; the
 * collaboration methods are called by {@link ResultService} inside its own transaction so the scorecard is saved,
 * validated, published and unpublished together with the result. Rows are only ever read by the result services (the
 * publish gate), so there is no non-manager read path.
 */
public interface ScorecardService {

    /**
     * The proposed line-up for each of the match's ours sides from the team selection: players in batting order (those
     * without an order after those with one), the 12th man last as a substitute. Writes nothing; empty lists when no
     * team was selected.
     */
    ScorecardPrefillDto prefill(Authentication authentication, UUID clubId, UUID matchId);

    /** The saved scorecard with each entry's suggested and effective featured flag; empty when the result has none; 404 without a result. */
    ScorecardDto read(Authentication authentication, UUID clubId, UUID matchId);

    /**
     * Links an unlinked scorecard player to a registered player of this club. Allowed on a draft or a published
     * result; records who linked and when. 409 when the profile is already on that side's list, 400 for another club's
     * profile or a player that is already linked.
     */
    ResultPlayerDto link(
            Authentication authentication, UUID clubId, UUID matchId, UUID resultPlayerId, UUID playerProfileId);

    /** Guest names the club has used (most recent first), optionally for one team, filtered by {@code q}. */
    Page<GuestNameDto> guestNames(
            Authentication authentication, UUID clubId, UUID teamId, String q, Pageable pageable);

    /**
     * Suggestions for the opposition's names: distinct names from earlier opposition players of this club against the
     * same opposition (the league team id when given or found on the match, else the normalised team name), most recent
     * first with a count, optionally for one of our teams and filtered by {@code q}. With {@code matchId} the opposition
     * is read from that match when not given and the names already on its result are left out. Text only: no identity.
     */
    Page<OppositionNameDto> oppositionNames(
            Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID leagueTeamId, String opposition,
            String q, Pageable pageable);

    // ---- collaboration with ResultService (same transaction) ----

    /**
     * Replaces the whole draft scorecard of {@code matchResultId} with {@code scorecard}: players keep their id when
     * sent, new ones carry a client key. Rejects (400 {@code InvalidResultException}) a player on a side that is not
     * ours or a profile of another club.
     */
    void replace(UUID matchResultId, UUID clubId, Match match, ScorecardDto scorecard, UUID updatedBy);

    /**
     * Re-derives the non-bowler wickets of every innings that has batting entries from those entries. A save that left
     * the scorecard untouched calls this so a client-sent figure cannot overwrite the derived one.
     */
    void refreshNonBowlerWickets(UUID matchResultId);

    /** The stored scorecard as part of a {@link ResultDraft}; an empty scorecard when there is none. */
    ScorecardDto load(UUID matchResultId, Match match);

    /** What the scorecard rules need beyond the draft (league limit, squads, club names); none for a draft without a scorecard. */
    ScorecardContext validationContext(Match match, ResultDraft draft);

    /** Freezes each entry's {@code featured} to its effective value (publish). */
    void freezeFeatured(UUID matchResultId, Match match);

    /** Clears each entry's {@code featured}; overrides are kept (unpublish). */
    void clearFeatured(UUID matchResultId);

    /** The official player of the match's display name per result id; results without one are absent. */
    Map<UUID, String> playersOfTheMatch(Collection<UUID> matchResultIds);
}
