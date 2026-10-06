package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration test for MatchSquadMemberRepository — per docs/standards/backend.md and
 * docs/specs/063-section-availability-and-flexible-squads.md's Test Plan (Integration row), proves
 * both of {@code match_squad_member}'s unique constraints are enforced at the real DB level, not
 * just pre-checked in the service layer:
 *
 * <ul>
 *   <li>{@code (match_id, team_id, player_profile_id)} — the defensive, simpler constraint.
 *   <li>{@code (section_availability_window_id, player_profile_id)} — the Part C hard block: the
 *       single most important proof in this whole feature. Two different {@link Match} rows whose
 *       teams both resolve to the <em>same</em> {@link SectionAvailabilityWindow} (the same
 *       section+date+day-part bracket) cannot both hold a {@link MatchSquadMember} row for the
 *       same player — the database itself rejects the second insert, so two teams can never
 *       accidentally double-book the same player for the same time slot, even under a race.
 * </ul>
 *
 * Mirrors {@code SectionAvailabilityWindowMatchRepositoryTest}'s own {@code saveAndFlush} +
 * {@code DataIntegrityViolationException} assertion pattern for an analogous single-column unique
 * constraint.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchSquadMemberRepositoryTest {

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;

    @Autowired
    private MatchSquadMemberRepository matchSquadMemberRepository;

    private Club savedClub() {
        return clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
    }

    private Section savedSection(UUID clubId) {
        return sectionRepository.save(Section.builder().clubId(clubId).name("Juniors").active(true).build());
    }

    private Season savedSeason(UUID clubId) {
        return seasonRepository.save(Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
    }

    private Team savedTeam(UUID clubId, UUID sectionId, String name) {
        return teamRepository.save(Team.builder().clubId(clubId).sectionId(sectionId).name(name)
                .active(true).build());
    }

    private Match savedMatch(UUID clubId, UUID seasonId, UUID homeTeamId) {
        Instant matchDate = LocalDate.of(2026, 9, 26).atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant();
        return matchRepository.save(Match.builder().clubId(clubId).homeTeamId(homeTeamId)
                .awayTeamName("Occasionals").seasonId(seasonId).matchDate(matchDate).active(true).build());
    }

    private SectionAvailabilityRound savedRound(UUID clubId, UUID sectionId) {
        LocalDate matchDate = LocalDate.of(2026, 9, 26);
        return sectionAvailabilityRoundRepository.save(SectionAvailabilityRound.builder()
                .clubId(clubId).sectionId(sectionId).description("Saturday fixtures")
                .firstMatchDate(matchDate).lastMatchDate(matchDate).autoClose(true).open(true).build());
    }

    private SectionAvailabilityWindow savedWindow(UUID clubId, UUID sectionId, UUID roundId) {
        return savedWindow(clubId, sectionId, roundId, DayPart.MORNING);
    }

    private SectionAvailabilityWindow savedWindow(UUID clubId, UUID sectionId, UUID roundId, DayPart dayPart) {
        return sectionAvailabilityWindowRepository.save(SectionAvailabilityWindow.builder()
                .clubId(clubId).sectionId(sectionId).roundId(roundId)
                .windowDate(LocalDate.of(2026, 9, 26)).dayPart(dayPart).open(true).build());
    }

    private PlayerProfile savedPlayer(UUID clubId) {
        Person person = personRepository.save(
                Person.builder().firstName("Alex").lastName("Player").build());
        return playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
    }

    @Test
    void uniqueConstraintRejectsADuplicateMatchTeamPlayerRow() {
        Club club = savedClub();
        Section section = savedSection(club.getId());
        Season season = savedSeason(club.getId());
        Team team = savedTeam(club.getId(), section.getId(), "U15 Colts");
        Match match = savedMatch(club.getId(), season.getId(), team.getId());
        SectionAvailabilityRound round = savedRound(club.getId(), section.getId());
        SectionAvailabilityWindow windowOne = savedWindow(club.getId(), section.getId(), round.getId(), DayPart.MORNING);
        SectionAvailabilityWindow windowTwo = savedWindow(club.getId(), section.getId(), round.getId(), DayPart.AFTERNOON);
        PlayerProfile player = savedPlayer(club.getId());

        matchSquadMemberRepository.save(MatchSquadMember.builder()
                .matchId(match.getId())
                .teamId(team.getId())
                .sectionAvailabilityWindowId(windowOne.getId())
                .playerProfileId(player.getId())
                .build());

        // Same (match_id, team_id, player_profile_id) as the row above, but pointed at a
        // different window — isolates the defensive constraint from the Part C hard block below.
        MatchSquadMember duplicate = MatchSquadMember.builder()
                .matchId(match.getId())
                .teamId(team.getId())
                .sectionAvailabilityWindowId(windowTwo.getId())
                .playerProfileId(player.getId())
                .build();

        assertThatThrownBy(() -> matchSquadMemberRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /**
     * The Part C hard block's real, DB-level proof: two different matches (and two different
     * teams) whose own brackets both resolve to the <em>same</em> {@link SectionAvailabilityWindow}
     * cannot both hold a {@code MatchSquadMember} row for the same player. This is the one test in
     * the whole feature that proves two teams can never accidentally double-book the same player
     * for the same time slot — the database rejects the second insert outright, not just the UI or
     * the service layer's own pre-check.
     */
    @Test
    void uniqueConstraintOnWindowAndPlayerRejectsTheSamePlayerPickedForTwoDifferentMatchesSharingOneWindow() {
        Club club = savedClub();
        Section section = savedSection(club.getId());
        Season season = savedSeason(club.getId());
        Team teamOne = savedTeam(club.getId(), section.getId(), "U15 Colts");
        Team teamTwo = savedTeam(club.getId(), section.getId(), "U15 Panthers");
        Match matchOne = savedMatch(club.getId(), season.getId(), teamOne.getId());
        Match matchTwo = savedMatch(club.getId(), season.getId(), teamTwo.getId());
        SectionAvailabilityRound round = savedRound(club.getId(), section.getId());
        SectionAvailabilityWindow window = savedWindow(club.getId(), section.getId(), round.getId());
        PlayerProfile player = savedPlayer(club.getId());

        matchSquadMemberRepository.save(MatchSquadMember.builder()
                .matchId(matchOne.getId())
                .teamId(teamOne.getId())
                .sectionAvailabilityWindowId(window.getId())
                .playerProfileId(player.getId())
                .build());

        assertThat(matchSquadMemberRepository
                        .findBySectionAvailabilityWindowIdAndPlayerProfileId(window.getId(), player.getId()))
                .isPresent();

        // Same window, same player, but a genuinely different match and team.
        MatchSquadMember pickedElsewhere = MatchSquadMember.builder()
                .matchId(matchTwo.getId())
                .teamId(teamTwo.getId())
                .sectionAvailabilityWindowId(window.getId())
                .playerProfileId(player.getId())
                .build();

        assertThatThrownBy(() -> matchSquadMemberRepository.saveAndFlush(pickedElsewhere))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /**
     * docs/specs/076-team-selection.md: deleting a group poll removes its squad rows (the foreign
     * key has no cascade). Proves only the given windows' rows go, against the real schema.
     */
    @Test
    void deleteBySectionAvailabilityWindowIdInRemovesOnlyTheGivenWindowsRows() {
        Club club = savedClub();
        Section section = savedSection(club.getId());
        Season season = savedSeason(club.getId());
        Team teamOne = savedTeam(club.getId(), section.getId(), "U15 Colts");
        Team teamTwo = savedTeam(club.getId(), section.getId(), "U15 Panthers");
        Match matchOne = savedMatch(club.getId(), season.getId(), teamOne.getId());
        Match matchTwo = savedMatch(club.getId(), season.getId(), teamTwo.getId());
        SectionAvailabilityRound round = savedRound(club.getId(), section.getId());
        SectionAvailabilityWindow deletedWindow =
                savedWindow(club.getId(), section.getId(), round.getId(), DayPart.MORNING);
        SectionAvailabilityWindow keptWindow =
                savedWindow(club.getId(), section.getId(), round.getId(), DayPart.AFTERNOON);
        PlayerProfile playerA = savedPlayer(club.getId());
        PlayerProfile playerB = savedPlayer(club.getId());

        matchSquadMemberRepository.save(squadRow(matchOne, teamOne, deletedWindow, playerA));
        matchSquadMemberRepository.save(squadRow(matchOne, teamOne, deletedWindow, playerB));
        MatchSquadMember kept = matchSquadMemberRepository.save(squadRow(matchTwo, teamTwo, keptWindow, playerA));
        matchSquadMemberRepository.flush();

        matchSquadMemberRepository.deleteBySectionAvailabilityWindowIdIn(List.of(deletedWindow.getId()));
        matchSquadMemberRepository.flush();

        assertThat(matchSquadMemberRepository.findAll())
                .extracting(MatchSquadMember::getId)
                .containsExactly(kept.getId());
        assertThat(matchSquadMemberRepository.existsBySectionAvailabilityWindowIdIn(List.of(deletedWindow.getId())))
                .isFalse();
        assertThat(matchSquadMemberRepository.existsBySectionAvailabilityWindowIdIn(List.of(keptWindow.getId())))
                .isTrue();
    }

    @Test
    void deleteBySectionAvailabilityWindowIdInWithNoWindowsDeletesNothing() {
        Club club = savedClub();
        Section section = savedSection(club.getId());
        Season season = savedSeason(club.getId());
        Team team = savedTeam(club.getId(), section.getId(), "U15 Colts");
        Match match = savedMatch(club.getId(), season.getId(), team.getId());
        SectionAvailabilityRound round = savedRound(club.getId(), section.getId());
        SectionAvailabilityWindow window = savedWindow(club.getId(), section.getId(), round.getId());
        MatchSquadMember row = matchSquadMemberRepository.saveAndFlush(
                squadRow(match, team, window, savedPlayer(club.getId())));

        matchSquadMemberRepository.deleteBySectionAvailabilityWindowIdIn(List.of());
        matchSquadMemberRepository.flush();

        assertThat(matchSquadMemberRepository.findAll()).extracting(MatchSquadMember::getId)
                .containsExactly(row.getId());
    }

    private MatchSquadMember squadRow(Match match, Team team, SectionAvailabilityWindow window, PlayerProfile player) {
        return MatchSquadMember.builder().matchId(match.getId()).teamId(team.getId())
                .sectionAvailabilityWindowId(window.getId()).playerProfileId(player.getId()).build();
    }
}
