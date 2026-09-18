package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
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
 * Integration test for PlayerAvailabilityRepository — per docs/standards/backend.md, proves the
 * {@code UNIQUE (poll_id, player_profile_id)} constraint at the DB level and {@code
 * findByPollId}/{@code findByPollIdAndPlayerProfileId}. See
 * docs/specs/032-match-availability-polls.md.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class PlayerAvailabilityRepositoryTest {

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

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    private record Fixture(Club club, MatchAvailabilityPoll poll) {
    }

    private Fixture savedPoll() {
        Club club = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        Match match = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Occasionals").seasonId(season.getId()).matchDate(Instant.now()).active(true).build());
        MatchAvailabilityPoll poll = matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId()).open(true).build());
        return new Fixture(club, poll);
    }

    private PlayerProfile savedPlayer(UUID clubId, String firstName) {
        Person person = personRepository.save(Person.builder().firstName(firstName).lastName("Player").build());
        return playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
    }

    @Test
    void findByPollIdAndPlayerProfileIdReturnsTheSavedRow() {
        Fixture fixture = savedPoll();
        PlayerProfile player = savedPlayer(fixture.club().getId(), "Alice");
        PlayerAvailability saved = playerAvailabilityRepository.save(PlayerAvailability.builder()
                .pollId(fixture.poll().getId())
                .playerProfileId(player.getId())
                .status(AvailabilityStatus.AVAILABLE)
                .build());

        assertThat(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(
                        fixture.poll().getId(), player.getId()))
                .contains(saved);
    }

    @Test
    void findByPollIdReturnsEveryResponseForThatPoll() {
        Fixture fixture = savedPoll();
        PlayerProfile playerA = savedPlayer(fixture.club().getId(), "Alice");
        PlayerProfile playerB = savedPlayer(fixture.club().getId(), "Bob");
        playerAvailabilityRepository.save(PlayerAvailability.builder()
                .pollId(fixture.poll().getId()).playerProfileId(playerA.getId())
                .status(AvailabilityStatus.AVAILABLE).build());
        playerAvailabilityRepository.save(PlayerAvailability.builder()
                .pollId(fixture.poll().getId()).playerProfileId(playerB.getId())
                .status(AvailabilityStatus.UNSURE).build());

        assertThat(playerAvailabilityRepository.findByPollId(fixture.poll().getId())).hasSize(2);
    }

    @Test
    void uniqueConstraintRejectsASecondResponseForTheSamePlayerOnTheSamePoll() {
        Fixture fixture = savedPoll();
        PlayerProfile player = savedPlayer(fixture.club().getId(), "Alice");
        playerAvailabilityRepository.save(PlayerAvailability.builder()
                .pollId(fixture.poll().getId()).playerProfileId(player.getId())
                .status(AvailabilityStatus.AVAILABLE).build());

        PlayerAvailability duplicate = PlayerAvailability.builder()
                .pollId(fixture.poll().getId()).playerProfileId(player.getId())
                .status(AvailabilityStatus.UNSURE).build();

        assertThatThrownBy(() -> playerAvailabilityRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
