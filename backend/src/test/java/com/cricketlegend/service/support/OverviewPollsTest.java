package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollType;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.OverviewPollDto;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for OverviewPolls (docs/specs/079-manager-shell-and-overview.md): squad and group poll
 * audience and reply counting, titles, scoping by accessible section, inactive matches left out.
 */
@ExtendWith(MockitoExtension.class)
class OverviewPollsTest {

    private static final UUID CLUB_ID = UUID.randomUUID();
    private static final UUID SENIORS = UUID.randomUUID();
    private static final UUID JUNIORS = UUID.randomUUID();
    private static final UUID SEASON = UUID.randomUUID();

    @Mock
    private MatchAvailabilityPollRepository pollRepository;

    @Mock
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Mock
    private TeamSquadMemberRepository squadRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionAvailabilityRoundRepository roundRepository;

    @Mock
    private SectionAvailabilityWindowRepository windowRepository;

    @Mock
    private SectionAvailabilityResponseRepository responseRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private AccessService accessService;

    private OverviewPolls polls;
    private final Team home = Team.builder().id(UUID.randomUUID()).clubId(CLUB_ID).sectionId(SENIORS)
            .name("Villagers 1").build();

    @BeforeEach
    void setUp() {
        polls = new OverviewPolls(pollRepository, playerAvailabilityRepository, squadRepository, matchRepository,
                teamRepository, roundRepository, windowRepository, responseRepository, playerSectionRepository,
                playerProfileRepository, accessService);
        lenient().when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of());
        lenient().when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of());
    }

    private Match match(boolean active) {
        return Match.builder().id(UUID.randomUUID()).clubId(CLUB_ID).homeTeamId(home.getId())
                .awayTeamName("Occasionals").seasonId(SEASON).matchDate(Instant.parse("2031-06-07T10:00:00Z"))
                .active(active).build();
    }

    private MatchAvailabilityPoll squadPoll(Match match, Instant closeAt) {
        return MatchAvailabilityPoll.builder().id(UUID.randomUUID()).matchId(match.getId()).teamId(home.getId())
                .open(true).scheduledCloseAt(closeAt).build();
    }

    private TeamSquadMember member(UUID playerId) {
        return TeamSquadMember.builder().teamId(home.getId()).seasonId(SEASON).playerProfileId(playerId).build();
    }

    private PlayerAvailability answer(MatchAvailabilityPoll poll, UUID playerId) {
        return PlayerAvailability.builder().pollId(poll.getId()).playerProfileId(playerId)
                .status(AvailabilityStatus.AVAILABLE).build();
    }

    @Test
    void noOpenPollsLoadsNothingElse() {
        assertThat(polls.openPolls(CLUB_ID, Optional.empty())).isEmpty();

        verifyNoInteractions(matchRepository, teamRepository, squadRepository, playerAvailabilityRepository,
                windowRepository, responseRepository, playerSectionRepository, playerProfileRepository);
    }

    @Test
    void squadPollCountsSquadMembersAndOnlyTheirAnswers() {
        Match match = match(true);
        Instant closeAt = Instant.parse("2031-06-06T10:00:00Z");
        MatchAvailabilityPoll poll = squadPoll(match, closeAt);
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        UUID leftTheSquad = UUID.randomUUID();
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of(poll));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(match));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));
        when(squadRepository.findByTeamIdInAndSeasonIdIn(anyCollection(), anyCollection()))
                .thenReturn(List.of(member(a), member(b), member(c)));
        when(playerAvailabilityRepository.findByPollIdIn(anyCollection()))
                .thenReturn(List.of(answer(poll, a), answer(poll, leftTheSquad)));

        List<OverviewPollDto> result = polls.openPolls(CLUB_ID, Optional.empty());

        assertThat(result).singleElement().satisfies(dto -> {
            assertThat(dto.kind()).isEqualTo(AvailabilityPollType.SQUAD);
            assertThat(dto.id()).isEqualTo(poll.getId());
            assertThat(dto.matchId()).isEqualTo(match.getId());
            assertThat(dto.totalCount()).isEqualTo(3);
            assertThat(dto.repliedCount()).isEqualTo(1);
            assertThat(dto.scheduledCloseAt()).isEqualTo(closeAt);
            assertThat(dto.title()).startsWith("Villagers 1 v Occasionals, ");
        });
    }

    @Test
    void squadPollOfADeactivatedMatchIsLeftOut() {
        Match inactive = match(false);
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of(squadPoll(inactive, null)));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(inactive));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));

        assertThat(polls.openPolls(CLUB_ID, Optional.empty())).isEmpty();
        verifyNoInteractions(squadRepository, playerAvailabilityRepository);
    }

    @Test
    void squadPollIsKeptOnlyWhenItsMatchResolvesToASectionTheCallerAdministers() {
        Match mine = match(true);
        Match elsewhere = match(true);
        MatchAvailabilityPoll minePoll = squadPoll(mine, null);
        MatchAvailabilityPoll elsewherePoll = squadPoll(elsewhere, null);
        when(pollRepository.findOpenByMatchClubId(CLUB_ID)).thenReturn(List.of(minePoll, elsewherePoll));
        when(matchRepository.findAllById(anyCollection())).thenReturn(List.of(mine, elsewhere));
        when(teamRepository.findAllById(anyCollection())).thenReturn(List.of(home));
        Map<UUID, Team> teams = Map.of(home.getId(), home);
        // both matches use the same home team here, so tell them apart by the away side (null for both):
        // resolve the first call to SENIORS and the second to JUNIORS
        when(accessService.resolveMatchSectionIds(CLUB_ID, home.getId(), null, teams))
                .thenReturn(Set.of(SENIORS), Set.of(JUNIORS));
        when(squadRepository.findByTeamIdInAndSeasonIdIn(anyCollection(), anyCollection())).thenReturn(List.of());
        when(playerAvailabilityRepository.findByPollIdIn(anyCollection())).thenReturn(List.of());

        List<OverviewPollDto> result = polls.openPolls(CLUB_ID, Optional.of(Set.of(JUNIORS)));

        assertThat(result).extracting(OverviewPollDto::id).containsExactly(elsewherePoll.getId());
    }

    @Test
    void groupPollCountsActiveTaggedPlayersAndRepliedMeansEveryWindowAnswered() {
        UUID roundId = UUID.randomUUID();
        Instant closeAt = Instant.parse("2031-06-06T10:00:00Z");
        SectionAvailabilityRound round = SectionAvailabilityRound.builder().id(roundId).clubId(CLUB_ID)
                .sectionId(SENIORS).description("Sat 7 Jun - Seniors").firstMatchDate(LocalDate.of(2031, 6, 7))
                .lastMatchDate(LocalDate.of(2031, 6, 7)).open(true).scheduledCloseAt(closeAt).build();
        UUID w1 = UUID.randomUUID();
        UUID w2 = UUID.randomUUID();
        UUID both = UUID.randomUUID();
        UUID onlyFirst = UUID.randomUUID();
        UUID none = UUID.randomUUID();
        UUID inactive = UUID.randomUUID();
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(round));
        when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityWindow.builder().id(w1).roundId(roundId).build(),
                SectionAvailabilityWindow.builder().id(w2).roundId(roundId).build()));
        when(responseRepository.findByWindowIdIn(anyCollection())).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(w1).playerProfileId(both).build(),
                SectionAvailabilityResponse.builder().windowId(w2).playerProfileId(both).build(),
                SectionAvailabilityResponse.builder().windowId(w1).playerProfileId(onlyFirst).build()));
        when(playerSectionRepository.findBySectionIdIn(anyCollection())).thenReturn(List.of(
                PlayerSection.builder().playerProfileId(both).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(onlyFirst).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(none).sectionId(SENIORS).build(),
                PlayerSection.builder().playerProfileId(inactive).sectionId(SENIORS).build()));
        when(playerProfileRepository.findAllById(anyCollection())).thenReturn(List.of(
                PlayerProfile.builder().id(both).active(true).build(),
                PlayerProfile.builder().id(onlyFirst).active(true).build(),
                PlayerProfile.builder().id(none).active(true).build(),
                PlayerProfile.builder().id(inactive).active(false).build()));

        List<OverviewPollDto> result = polls.openPolls(CLUB_ID, Optional.empty());

        assertThat(result).singleElement().satisfies(dto -> {
            assertThat(dto.kind()).isEqualTo(AvailabilityPollType.GROUP);
            assertThat(dto.id()).isEqualTo(roundId);
            assertThat(dto.matchId()).isNull();
            assertThat(dto.title()).isEqualTo("Sat 7 Jun - Seniors");
            assertThat(dto.totalCount()).isEqualTo(3);
            assertThat(dto.repliedCount()).isEqualTo(1);
            assertThat(dto.scheduledCloseAt()).isEqualTo(closeAt);
        });
    }

    @Test
    void groupPollOfASectionTheCallerDoesNotAdministerIsLeftOut() {
        SectionAvailabilityRound round = SectionAvailabilityRound.builder().id(UUID.randomUUID()).clubId(CLUB_ID)
                .sectionId(SENIORS).description("Seniors").open(true).build();
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(round));

        assertThat(polls.openPolls(CLUB_ID, Optional.of(Set.of(JUNIORS)))).isEmpty();
        verifyNoInteractions(windowRepository, responseRepository, playerSectionRepository);
    }

    @Test
    void groupPollWithNobodyTaggedHasAnEmptyAudience() {
        SectionAvailabilityRound round = SectionAvailabilityRound.builder().id(UUID.randomUUID()).clubId(CLUB_ID)
                .sectionId(SENIORS).description("Seniors").open(true).build();
        when(roundRepository.findByClubIdAndOpenTrue(CLUB_ID)).thenReturn(List.of(round));
        when(windowRepository.findByRoundIdIn(anyCollection())).thenReturn(List.of());
        when(playerSectionRepository.findBySectionIdIn(anyCollection())).thenReturn(List.of());

        assertThat(polls.openPolls(CLUB_ID, Optional.empty())).singleElement().satisfies(dto -> {
            assertThat(dto.totalCount()).isZero();
            assertThat(dto.repliedCount()).isZero();
        });
    }
}
