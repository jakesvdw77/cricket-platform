package com.cricketlegend.service.support;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import java.util.UUID;

/**
 * Shared {@code League}/{@code Season} cross-club existence check, extracted per
 * docs/standards/backend.md's "shared logic lives in one place" rule after {@code
 * MatchServiceImpl.validateLeagueAndSeason} and {@code
 * LeaguePlayingConditionsServiceImpl.validateLeagueAndSeason} both needed the identical
 * find-or-{@link NotFoundException} + {@code clubId} match check (found in standards review of
 * docs/specs/050-league-schedule-and-fixtures.md). Deliberately a plain static utility — the
 * caller's own {@link LeagueRepository}/{@link SeasonRepository} is passed in rather than this
 * class becoming a new Spring bean/constructor dependency on either caller — matching {@link
 * SocialLinkValidation}'s own shape in this package for the identical kind of small, stateless,
 * shared validation rule.
 *
 * <p>Each call site keeps its own wrinkle around whether/when a reference is required and what
 * happens when it's absent — {@code Match.leagueId} is optional (only validated when non-null,
 * {@code seasonId} always required); {@code LeaguePlayingConditions.leagueId}/{@code seasonId} are
 * both always required. That decision stays at the call site, not inside this class, which only
 * ever answers "given this id is being checked, does it belong to this club."
 */
public final class LeagueSeasonAccessValidation {

    private LeagueSeasonAccessValidation() {}

    /** Throws {@link NotFoundException} when {@code leagueId} doesn't exist, or belongs to a different club. */
    public static void assertLeagueBelongsToClub(LeagueRepository leagueRepository, UUID leagueId, UUID clubId) {
        League league = leagueRepository
                .findById(leagueId)
                .orElseThrow(() -> new NotFoundException("League not found: " + leagueId));
        if (!league.getClubId().equals(clubId)) {
            throw new NotFoundException("League not found: " + leagueId);
        }
    }

    /** Throws {@link NotFoundException} when {@code seasonId} doesn't exist, or belongs to a different club. */
    public static void assertSeasonBelongsToClub(SeasonRepository seasonRepository, UUID seasonId, UUID clubId) {
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        if (!season.getClubId().equals(clubId)) {
            throw new NotFoundException("Season not found: " + seasonId);
        }
    }
}
