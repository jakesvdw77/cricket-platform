package com.cricketlegend.service;

import com.cricketlegend.dto.SectionAvailabilityFixtureGroupDto;
import java.util.List;
import java.util.UUID;

/**
 * Replaces the old live time-based scan for the one place a live view of "what's out there" is
 * still genuinely needed: proposing what a *new* {@code SectionAvailabilityRound} could cover.
 * Given a {@code sectionId}, it: (1) finds every {@code Match} of a team in that
 * section with a future {@code matchDate} (naturally small and bounded — one section's own
 * upcoming fixtures — needing no further limit or pagination); (2) for each, resolves its own
 * {@code (date, day-part)} bracket key (reusing {@link SectionAvailabilityMatchResolver
 * #resolveWindowKey}) and checks whether a {@code SectionAvailabilityWindow} already exists for
 * that key — if so, the match is flagged {@code alreadyPolled: true} with a reference to the
 * existing window's own round (id + description), if not, it's a genuine candidate; (3) groups
 * every match's own distinct calendar date (not exact time) by straightforward date adjacency —
 * sorted ascending, a date starts a new group unless it's exactly one calendar day after the
 * current group's latest date, so Saturday+Sunday cluster together and a following Tuesday (a
 * two-day gap) starts its own group. This clustering runs across already-polled and
 * not-yet-polled matches alike, so a proposed group shows its full real context. Not named in the
 * spec's own prose in code form (the spec's prose describes the algorithm, this interface names
 * it), the one genuinely new piece of logic in this spec's fixture-group-selection revision — not
 * a reuse or rename of anything. See docs/specs/063-section-availability-and-flexible-squads.md.
 */
public interface SectionAvailabilityFixtureGroupResolver {

    List<SectionAvailabilityFixtureGroupDto> resolveGroups(UUID clubId, UUID sectionId);
}
