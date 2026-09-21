package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * Response shape of {@code GET /matches/filter-options} — see
 * docs/specs/042-match-list-filters-and-search.md. {@code sectionIds}/{@code leagueIds}/{@code
 * seasonIds} are each the set of ids still reachable among the club's matches given whichever
 * *other* filters (from {@code sectionId}/{@code leagueId}/{@code seasonId}/{@code search}/{@code
 * upcomingOnly}) the caller currently has active — e.g. {@code leagueIds} is computed ignoring the
 * caller's own {@code leagueId} selection, so picking a League doesn't make itself disappear from
 * its own dropdown. Ids only, not full records — the frontend already holds the full {@code
 * Section}/{@code League}/{@code Season} objects and uses these arrays purely to narrow its own
 * already-loaded option lists.
 *
 * <p>{@code teamIds} is different in kind: it drives the Search field's team-name autocomplete
 * suggestions (not a picker's own dropdown options), so it's computed from the caller's currently
 * active {@code sectionId}/{@code leagueId}/{@code seasonId}/{@code upcomingOnly} — narrowed by
 * every filter the admin has actually picked, exactly like the match list itself — but
 * deliberately NOT narrowed by {@code search}: suggesting team names to help decide what to type
 * next would be circular if the suggestion list itself shrank based on what's already been typed.
 */
public record MatchFilterOptionsDto(
        List<UUID> sectionIds, List<UUID> leagueIds, List<UUID> seasonIds, List<UUID> teamIds) {
}
