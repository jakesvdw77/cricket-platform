package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for MatchAvailabilityPollRepository — per docs/standards/backend.md, proves
 * that migration {@code 023-add-availability-polls.sql} applies cleanly against the existing
 * {@code 029}/{@code 028} tables, the {@code UNIQUE (match_id, team_id)} constraint at the DB
 * level, and {@code existsByMatchIdAndTeamId}/{@code findByMatchId}. See
 * docs/specs/032-match-availability-polls.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchAvailabilityPollRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private MatchAvailabilityPollRepository matchAvailabilityPollRepository;

    private Club savedClub(String slug) {
        return clubRepository.save(Club.builder().name("Riverside CC").slug(slug).status(ClubStatus.ACTIVE).build());
    }

    private Team savedTeam(UUID clubId) {
        Section section = sectionRepository.save(Section.builder().clubId(clubId).name("Men").active(true).build());
        return teamRepository.save(
                Team.builder().clubId(clubId).sectionId(section.getId()).name("1st XI").active(true).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private Match savedMatch(UUID clubId, UUID homeTeamId, UUID seasonId) {
        return matchRepository.save(Match.builder().clubId(clubId).homeTeamId(homeTeamId)
                .awayTeamName("Away Occasionals").seasonId(seasonId).matchDate(Instant.now()).active(true).build());
    }

    @Test
    void existsByMatchIdAndTeamIdReflectsCurrentPolls() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Match match = savedMatch(club.getId(), team.getId(), season.getId());

        assertThat(matchAvailabilityPollRepository.existsByMatchIdAndTeamId(match.getId(), team.getId()))
                .isFalse();

        matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId()).open(true).build());

        assertThat(matchAvailabilityPollRepository.existsByMatchIdAndTeamId(match.getId(), team.getId()))
                .isTrue();
    }

    @Test
    void findByMatchIdAndTeamIdReturnsTheSavedPoll() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Match match = savedMatch(club.getId(), team.getId(), season.getId());
        MatchAvailabilityPoll saved = matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId()).open(true).build());

        assertThat(matchAvailabilityPollRepository.findByMatchIdAndTeamId(match.getId(), team.getId()))
                .contains(saved);
    }

    @Test
    void findByMatchIdReturnsEveryPollForThatMatch() {
        Club club = savedClub("riverside-cc");
        Team homeTeam = savedTeam(club.getId());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Women").active(true).build());
        Team awayTeam = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("2nd XI").active(true).build());
        Season season = savedSeason(club.getId());
        Match match = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(homeTeam.getId())
                .awayTeamId(awayTeam.getId()).seasonId(season.getId()).matchDate(Instant.now()).active(true).build());
        matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(homeTeam.getId()).open(true).build());
        matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(awayTeam.getId()).open(true).build());

        assertThat(matchAvailabilityPollRepository.findByMatchId(match.getId())).hasSize(2);
    }

    @Test
    void findOpenByMatchClubIdReturnsOnlyOpenPollsWhoseMatchBelongsToTheGivenClub() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Match openMatch = savedMatch(club.getId(), team.getId(), season.getId());
        Match closedMatch = savedMatch(club.getId(), team.getId(), season.getId());
        matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(openMatch.getId()).teamId(team.getId()).open(true).build());
        MatchAvailabilityPoll closedPoll = matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(closedMatch.getId()).teamId(team.getId()).open(false).build());

        Club otherClub = savedClub("lakeside-cc");
        Team otherTeam = savedTeam(otherClub.getId());
        Season otherSeason = savedSeason(otherClub.getId());
        Match otherClubMatch = savedMatch(otherClub.getId(), otherTeam.getId(), otherSeason.getId());
        matchAvailabilityPollRepository.save(MatchAvailabilityPoll.builder()
                .matchId(otherClubMatch.getId()).teamId(otherTeam.getId()).open(true).build());

        java.util.List<MatchAvailabilityPoll> result =
                matchAvailabilityPollRepository.findOpenByMatchClubId(club.getId());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMatchId()).isEqualTo(openMatch.getId());
        assertThat(result).extracting(MatchAvailabilityPoll::getId).doesNotContain(closedPoll.getId());
    }

    @Test
    void findClosedByMatchClubIdReturnsOnlyClosedPollsOfTheClubOrderedByMatchDateDescending() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Match older = matchOn(club, team, season, Instant.parse("2026-05-01T10:00:00Z"));
        Match newer = matchOn(club, team, season, Instant.parse("2026-06-01T10:00:00Z"));
        Match openMatch = matchOn(club, team, season, Instant.parse("2026-07-01T10:00:00Z"));
        MatchAvailabilityPoll olderPoll = matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(older.getId()).teamId(team.getId()).open(false).build());
        MatchAvailabilityPoll newerPoll = matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(newer.getId()).teamId(team.getId()).open(false).build());
        matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(openMatch.getId()).teamId(team.getId()).open(true).build());

        Club otherClub = savedClub("lakeside-cc");
        Team otherTeam = savedTeam(otherClub.getId());
        Season otherSeason = savedSeason(otherClub.getId());
        Match otherClubMatch = matchOn(otherClub, otherTeam, otherSeason, Instant.parse("2026-08-01T10:00:00Z"));
        matchAvailabilityPollRepository.save(MatchAvailabilityPoll.builder()
                .matchId(otherClubMatch.getId()).teamId(otherTeam.getId()).open(false).build());

        assertThat(matchAvailabilityPollRepository.findClosedByMatchClubId(club.getId()))
                .extracting(MatchAvailabilityPoll::getId)
                .containsExactly(newerPoll.getId(), olderPoll.getId());
    }

    private Match matchOn(Club club, Team team, Season season, Instant matchDate) {
        return matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Away Occasionals").seasonId(season.getId()).matchDate(matchDate).active(true).build());
    }

    @Test
    void uniqueConstraintRejectsASecondPollForTheSameTeamOnTheSameMatch() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Match match = savedMatch(club.getId(), team.getId(), season.getId());
        matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId()).open(true).build());

        MatchAvailabilityPoll duplicate =
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId()).open(true).build();

        assertThatThrownBy(() -> matchAvailabilityPollRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findDueForAutoCloseReturnsOnlyOpenAutoClosePollsWhoseScheduledCloseAtHasPassed() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        Instant now = Instant.parse("2026-10-02T12:00:00Z");
        MatchAvailabilityPoll due = pollWith(club, team, season, true, true, now.minusSeconds(60));
        pollWith(club, team, season, true, true, now.plusSeconds(3600)); // not yet due
        pollWith(club, team, season, false, true, now.minusSeconds(60)); // already closed
        pollWith(club, team, season, true, false, now.minusSeconds(60)); // autoClose off
        pollWith(club, team, season, true, true, null); // no scheduled time

        assertThat(matchAvailabilityPollRepository.findDueForAutoClose(now))
                .extracting(MatchAvailabilityPoll::getId)
                .containsExactly(due.getId());
    }

    private MatchAvailabilityPoll pollWith(
            Club club, Team team, Season season, boolean open, boolean autoClose, Instant scheduledCloseAt) {
        Match match = savedMatch(club.getId(), team.getId(), season.getId());
        return matchAvailabilityPollRepository.save(MatchAvailabilityPoll.builder()
                .matchId(match.getId()).teamId(team.getId()).open(open)
                .autoClose(autoClose).scheduledCloseAt(scheduledCloseAt).build());
    }
}
