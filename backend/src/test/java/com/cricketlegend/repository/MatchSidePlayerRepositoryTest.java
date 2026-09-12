package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayingRole;
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
 * Integration test for MatchSidePlayerRepository — per docs/standards/backend.md, proves both
 * unique constraints ({@code (match_side_id, player_profile_id)} and {@code (match_side_id,
 * batting_order)}) at the DB level, and {@code findByMatchSideIdOrderByBattingOrderAsc}'s
 * ordering. See docs/specs/029-league-management.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchSidePlayerRepositoryTest {

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
    private MatchSideRepository matchSideRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private MatchSidePlayerRepository matchSidePlayerRepository;

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

    private MatchSide savedSide(UUID clubId, UUID teamId, UUID seasonId) {
        Match match = matchRepository.save(Match.builder().clubId(clubId).homeTeamId(teamId)
                .awayTeamName("Away Occasionals").seasonId(seasonId).matchDate(Instant.now()).active(true).build());
        return matchSideRepository.save(MatchSide.builder().matchId(match.getId()).teamId(teamId).build());
    }

    private PlayerProfile savedPlayer(UUID clubId) {
        Person person = personRepository.save(Person.builder().firstName("Joe").lastName("Bloggs").build());
        return playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
    }

    @Test
    void findByMatchSideIdOrderByBattingOrderAscReturnsPlayersInBattingOrder() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        MatchSide side = savedSide(club.getId(), team.getId(), season.getId());
        PlayerProfile playerOne = savedPlayer(club.getId());
        PlayerProfile playerTwo = savedPlayer(club.getId());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId())
                .playerProfileId(playerTwo.getId()).battingOrder(2).role(PlayingRole.BOWLER).build());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId())
                .playerProfileId(playerOne.getId()).battingOrder(1).role(PlayingRole.BATSMAN).build());

        assertThat(matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(side.getId()))
                .extracting(MatchSidePlayer::getPlayerProfileId)
                .containsExactly(playerOne.getId(), playerTwo.getId());
    }

    @Test
    void uniqueConstraintRejectsTheSamePlayerAddedTwiceToTheSameSide() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        MatchSide side = savedSide(club.getId(), team.getId(), season.getId());
        PlayerProfile player = savedPlayer(club.getId());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId())
                .playerProfileId(player.getId()).battingOrder(1).role(PlayingRole.BATSMAN).build());

        MatchSidePlayer duplicate = MatchSidePlayer.builder().matchSideId(side.getId())
                .playerProfileId(player.getId()).battingOrder(2).role(PlayingRole.BOWLER).build();

        assertThatThrownBy(() -> matchSidePlayerRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void uniqueConstraintRejectsTwoPlayersSharingTheSameBattingOrderOnTheSameSide() {
        Club club = savedClub("riverside-cc");
        Team team = savedTeam(club.getId());
        Season season = savedSeason(club.getId());
        MatchSide side = savedSide(club.getId(), team.getId(), season.getId());
        PlayerProfile playerOne = savedPlayer(club.getId());
        PlayerProfile playerTwo = savedPlayer(club.getId());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId())
                .playerProfileId(playerOne.getId()).battingOrder(1).role(PlayingRole.BATSMAN).build());

        MatchSidePlayer clashingOrder = MatchSidePlayer.builder().matchSideId(side.getId())
                .playerProfileId(playerTwo.getId()).battingOrder(1).role(PlayingRole.BOWLER).build();

        assertThatThrownBy(() -> matchSidePlayerRepository.saveAndFlush(clashingOrder))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
