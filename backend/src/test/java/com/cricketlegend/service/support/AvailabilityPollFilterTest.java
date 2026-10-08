package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Unit tests for the matching rules of AvailabilityPollFilter (docs/specs/083-availability-filters-and-toolbars.md). */
class AvailabilityPollFilterTest {

    private static final UUID LEAGUE = UUID.randomUUID();
    private static final UUID SECTION = UUID.randomUUID();
    private static final UUID TEAM = UUID.randomUUID();
    private static final UUID OTHER_TEAM = UUID.randomUUID();

    private static AvailabilityPollFilter filter(
            UUID league, Set<UUID> sections, UUID team, AvailabilityPollTypeFilter type) {
        return new AvailabilityPollFilter(league, sections, team, type, false);
    }

    private static Match match(UUID league, UUID home, UUID away) {
        return Match.builder().id(UUID.randomUUID()).leagueId(league).homeTeamId(home).awayTeamId(away).build();
    }

    private static MatchAvailabilityPoll poll(UUID team) {
        return MatchAvailabilityPoll.builder().id(UUID.randomUUID()).teamId(team).build();
    }

    private static SectionAvailabilityRound round(UUID section) {
        return SectionAvailabilityRound.builder().id(UUID.randomUUID()).sectionId(section).build();
    }

    @Test
    void aNullTypeMeansAllAndOpenOnlyHasNoNarrowing() {
        assertThat(filter(null, null, null, null).type()).isEqualTo(AvailabilityPollTypeFilter.ALL);
        assertThat(AvailabilityPollFilter.OPEN_ONLY.includeClosed()).isFalse();
        assertThat(AvailabilityPollFilter.OPEN_ONLY.needsGroupMatches()).isFalse();
        assertThat(AvailabilityPollFilter.OPEN_ONLY.matchesSquad(poll(TEAM), match(null, TEAM, null), Set.of())).isTrue();
        assertThat(AvailabilityPollFilter.OPEN_ONLY.matchesGroup(round(SECTION), List.of())).isTrue();
    }

    @Test
    void typeSelectsWhichKindsAreIncluded() {
        AvailabilityPollFilter group = filter(null, null, null, AvailabilityPollTypeFilter.GROUP);
        AvailabilityPollFilter squad = filter(null, null, null, AvailabilityPollTypeFilter.SQUAD);

        assertThat(group.matchesSquad(poll(TEAM), match(null, TEAM, null), Set.of())).isFalse();
        assertThat(group.matchesGroup(round(SECTION), List.of())).isTrue();
        assertThat(squad.matchesGroup(round(SECTION), List.of())).isFalse();
        assertThat(squad.matchesSquad(poll(TEAM), match(null, TEAM, null), Set.of())).isTrue();
    }

    @Test
    void squadLeagueMustEqualTheMatchesLeague() {
        AvailabilityPollFilter byLeague = filter(LEAGUE, null, null, null);

        assertThat(byLeague.matchesSquad(poll(TEAM), match(LEAGUE, TEAM, null), Set.of())).isTrue();
        assertThat(byLeague.matchesSquad(poll(TEAM), match(UUID.randomUUID(), TEAM, null), Set.of())).isFalse();
        assertThat(byLeague.matchesSquad(poll(TEAM), match(null, TEAM, null), Set.of())).isFalse();
    }

    @Test
    void squadTeamMustEqualThePollsTeam() {
        AvailabilityPollFilter byTeam = filter(null, null, TEAM, null);
        Match match = match(null, TEAM, OTHER_TEAM);

        assertThat(byTeam.matchesSquad(poll(TEAM), match, Set.of())).isTrue();
        assertThat(byTeam.matchesSquad(poll(OTHER_TEAM), match, Set.of())).isFalse();
    }

    @Test
    void squadSectionMatchesWhenAnyOwnClubSectionOfTheMatchIsInTheSet() {
        AvailabilityPollFilter bySection = filter(null, Set.of(SECTION), null, null);
        Match match = match(null, TEAM, null);

        assertThat(bySection.matchesSquad(poll(TEAM), match, Set.of(UUID.randomUUID(), SECTION))).isTrue();
        assertThat(bySection.matchesSquad(poll(TEAM), match, Set.of(UUID.randomUUID()))).isFalse();
        assertThat(bySection.matchesSquad(poll(TEAM), match, Set.of())).isFalse();
    }

    @Test
    void anEmptySectionSetMatchesNothing() {
        AvailabilityPollFilter nothing = filter(null, Set.of(), null, null);

        assertThat(nothing.matchesSquad(poll(TEAM), match(null, TEAM, null), Set.of(SECTION))).isFalse();
        assertThat(nothing.matchesGroup(round(SECTION), List.of())).isFalse();
    }

    @Test
    void groupSectionMustContainTheRoundsSection() {
        AvailabilityPollFilter bySection = filter(null, Set.of(SECTION), null, null);

        assertThat(bySection.matchesGroup(round(SECTION), List.of())).isTrue();
        assertThat(bySection.matchesGroup(round(UUID.randomUUID()), List.of())).isFalse();
    }

    @Test
    void groupLeagueMatchesWhenAnySlotMatchIsInTheLeague() {
        AvailabilityPollFilter byLeague = filter(LEAGUE, null, null, null);
        Match in = match(LEAGUE, TEAM, null);
        Match out = match(UUID.randomUUID(), TEAM, null);

        assertThat(byLeague.needsGroupMatches()).isTrue();
        assertThat(byLeague.matchesGroup(round(SECTION), List.of(out, in))).isTrue();
        assertThat(byLeague.matchesGroup(round(SECTION), List.of(out))).isFalse();
        assertThat(byLeague.matchesGroup(round(SECTION), List.of())).isFalse();
    }

    @Test
    void groupTeamMatchesWhenTheTeamIsEitherSideOfAnySlotMatch() {
        AvailabilityPollFilter byTeam = filter(null, null, TEAM, null);

        assertThat(byTeam.matchesGroup(round(SECTION), List.of(match(null, TEAM, null)))).isTrue();
        assertThat(byTeam.matchesGroup(round(SECTION), List.of(match(null, OTHER_TEAM, TEAM)))).isTrue();
        assertThat(byTeam.matchesGroup(round(SECTION), List.of(match(null, OTHER_TEAM, null)))).isFalse();
        assertThat(byTeam.matchesGroup(round(SECTION), List.of())).isFalse();
    }

    @Test
    void leagueAndTeamMayBeSatisfiedByDifferentSlotMatches() {
        AvailabilityPollFilter both = filter(LEAGUE, null, TEAM, null);

        assertThat(both.matchesGroup(round(SECTION), List.of(match(LEAGUE, OTHER_TEAM, null), match(null, TEAM, null))))
                .isTrue();
    }
}
