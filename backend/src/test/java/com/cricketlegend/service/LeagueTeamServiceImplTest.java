package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.CopyLeagueTeamsRequest;
import com.cricketlegend.dto.CopyLeagueTeamsResponse;
import com.cricketlegend.dto.CreateLeagueTeamRequest;
import com.cricketlegend.dto.LeagueTeamDto;
import com.cricketlegend.dto.LeagueTeamRemoveOutcome;
import com.cricketlegend.dto.RemoveLeagueTeamResponse;
import com.cricketlegend.dto.UpdateLeagueTeamRequest;
import com.cricketlegend.exception.DuplicateLeagueTeamNameException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueTeamMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.LeagueTeamRepository.ReferencedMatchCount;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.impl.LeagueTeamServiceImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for LeagueTeamServiceImpl's business rules from docs/specs/070-league-teams.md:
 * name trimming/blank/duplicate rules, update propagation to matches, deactivate/reactivate
 * guards, remove (delete versus deactivate), copy semantics, and cross-club 404s.
 */
@ExtendWith(MockitoExtension.class)
class LeagueTeamServiceImplTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private LeagueTeamRepository leagueTeamRepository;

    @Mock
    private MatchRepository matchRepository;

    private LeagueTeamServiceImpl service;

    private final UUID clubId = UUID.randomUUID();
    private final UUID leagueId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new LeagueTeamServiceImpl(
                leagueRepository, seasonRepository, leagueTeamRepository, matchRepository,
                Mappers.getMapper(LeagueTeamMapper.class));
    }

    private void stubLeagueAndSeasonOfThisClub() {
        stubLeague(leagueId, clubId);
        stubSeason(seasonId, clubId);
    }

    private void stubLeague(UUID id, UUID owningClubId) {
        when(leagueRepository.findById(id)).thenReturn(Optional.of(League.builder().id(id).clubId(owningClubId)
                .name("Premier").source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build()));
    }

    private void stubSeason(UUID id, UUID owningClubId) {
        when(seasonRepository.findById(id)).thenReturn(Optional.of(Season.builder().id(id).clubId(owningClubId)
                .label("2026").startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31))
                .active(true).build()));
    }

    private LeagueTeam team(UUID id, UUID inLeagueId, UUID inSeasonId, String name, boolean active) {
        return LeagueTeam.builder().id(id).leagueId(inLeagueId).seasonId(inSeasonId).name(name)
                .abbreviation("ABB").logoUrl("/media/" + name + ".png").active(active).build();
    }

    private ReferencedMatchCount count(UUID id, long matches) {
        return new ReferencedMatchCount() {
            @Override
            public UUID getLeagueTeamId() {
                return id;
            }

            @Override
            public long getMatchCount() {
                return matches;
            }
        };
    }

    // --- list ---

    @Test
    void listReturnsTeamsWithBatchedReferencedByMatchCountInOneQuery() {
        stubLeagueAndSeasonOfThisClub();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        when(leagueTeamRepository.findByLeagueAndSeason(leagueId, seasonId))
                .thenReturn(List.of(team(a, leagueId, seasonId, "Alpha", true), team(b, leagueId, seasonId, "Beta", false)));
        when(leagueTeamRepository.countReferencingMatches(List.of(a, b))).thenReturn(List.of(count(b, 3)));

        List<LeagueTeamDto> result = service.list(clubId, leagueId, seasonId, false);

        assertThat(result).extracting(LeagueTeamDto::name).containsExactly("Alpha", "Beta");
        assertThat(result).extracting(LeagueTeamDto::referencedByMatchCount).containsExactly(0L, 3L);
        assertThat(result.get(1).active()).isFalse();
        verify(leagueTeamRepository).countReferencingMatches(List.of(a, b));
    }

    @Test
    void listWithActiveOnlyUsesTheActiveQuery() {
        stubLeagueAndSeasonOfThisClub();
        when(leagueTeamRepository.findActiveByLeagueAndSeason(leagueId, seasonId)).thenReturn(List.of());

        assertThat(service.list(clubId, leagueId, seasonId, true)).isEmpty();

        verify(leagueTeamRepository, never()).findByLeagueAndSeason(any(), any());
        verify(leagueTeamRepository, never()).countReferencingMatches(any());
    }

    @Test
    void listThrowsNotFoundWhenTheLeagueBelongsToAnotherClub() {
        stubLeague(leagueId, UUID.randomUUID());

        assertThatThrownBy(() -> service.list(clubId, leagueId, seasonId, false))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void listThrowsNotFoundWhenTheSeasonBelongsToAnotherClub() {
        stubLeague(leagueId, clubId);
        stubSeason(seasonId, UUID.randomUUID());

        assertThatThrownBy(() -> service.list(clubId, leagueId, seasonId, false))
                .isInstanceOf(NotFoundException.class);
    }

    // --- create ---

    @Test
    void createTrimsTheNameAndSavesAnActiveTeam() {
        stubLeagueAndSeasonOfThisClub();
        when(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCase(leagueId, seasonId, "Riverside CC"))
                .thenReturn(false);
        ArgumentCaptor<LeagueTeam> captor = ArgumentCaptor.forClass(LeagueTeam.class);
        when(leagueTeamRepository.save(captor.capture())).thenAnswer(i -> captor.getValue());

        LeagueTeamDto dto =
                service.create(clubId, leagueId, seasonId, new CreateLeagueTeamRequest("  Riverside CC  ", " RCC ", ""));

        LeagueTeam saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("Riverside CC");
        assertThat(saved.getAbbreviation()).isEqualTo("RCC");
        assertThat(saved.getLogoUrl()).isNull();
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getLeagueId()).isEqualTo(leagueId);
        assertThat(saved.getSeasonId()).isEqualTo(seasonId);
        assertThat(dto.name()).isEqualTo("Riverside CC");
        assertThat(dto.referencedByMatchCount()).isZero();
    }

    @Test
    void createWithABlankNameThrowsValidationException() {
        stubLeagueAndSeasonOfThisClub();

        assertThatThrownBy(() -> service.create(clubId, leagueId, seasonId, new CreateLeagueTeamRequest("   ", null, null)))
                .isInstanceOf(ValidationException.class);
        verify(leagueTeamRepository, never()).save(any());
    }

    @Test
    void createWithADuplicateNameThrowsDuplicateLeagueTeamNameException() {
        stubLeagueAndSeasonOfThisClub();
        // the repository check counts inactive rows too, and is case-insensitive
        when(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCase(leagueId, seasonId, "riverside cc"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(
                        clubId, leagueId, seasonId, new CreateLeagueTeamRequest("riverside cc", null, null)))
                .isInstanceOf(DuplicateLeagueTeamNameException.class);
        verify(leagueTeamRepository, never()).save(any());
    }

    @Test
    void createThrowsNotFoundWhenTheLeagueBelongsToAnotherClub() {
        stubLeague(leagueId, UUID.randomUUID());

        assertThatThrownBy(() -> service.create(clubId, leagueId, seasonId, new CreateLeagueTeamRequest("X", null, null)))
                .isInstanceOf(NotFoundException.class);
        verify(leagueTeamRepository, never()).save(any());
    }

    // --- update ---

    @Test
    void updateWithAChangedNamePropagatesToHomeAndAwayMatchesAndReturnsTheReferencedCount() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        LeagueTeam existing = team(id, leagueId, seasonId, "Riversde CC", true);
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(existing));
        when(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCaseAndIdNot(
                        leagueId, seasonId, "Riverside CC", id))
                .thenReturn(false);
        when(leagueTeamRepository.save(existing)).thenReturn(existing);
        when(leagueTeamRepository.countReferencingMatches(List.of(id))).thenReturn(List.of(count(id, 2)));

        LeagueTeamDto dto = service.update(
                clubId, leagueId, seasonId, id,
                new UpdateLeagueTeamRequest("Riverside CC", "RCC", "/media/Riversde CC.png"));

        assertThat(existing.getName()).isEqualTo("Riverside CC");
        assertThat(dto.referencedByMatchCount()).isEqualTo(2L);
        verify(matchRepository).propagateLeagueTeamToHomeSide(
                eq(id), eq("Riverside CC"), eq("/media/Riversde CC.png"), any(Instant.class));
        verify(matchRepository).propagateLeagueTeamToAwaySide(
                eq(id), eq("Riverside CC"), eq("/media/Riversde CC.png"), any(Instant.class));
    }

    @Test
    void updateWithAChangedLogoPropagatesTheNewLogoIncludingClearingIt() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        LeagueTeam existing = team(id, leagueId, seasonId, "Riverside CC", true);
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(existing));
        when(leagueTeamRepository.save(existing)).thenReturn(existing);

        service.update(clubId, leagueId, seasonId, id, new UpdateLeagueTeamRequest("Riverside CC", "RCC", null));

        verify(matchRepository).propagateLeagueTeamToHomeSide(eq(id), eq("Riverside CC"), eq(null), any(Instant.class));
        verify(matchRepository).propagateLeagueTeamToAwaySide(eq(id), eq("Riverside CC"), eq(null), any(Instant.class));
    }

    @Test
    void updateChangingOnlyTheAbbreviationDoesNotPropagate() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        LeagueTeam existing = team(id, leagueId, seasonId, "Riverside CC", true);
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(existing));
        when(leagueTeamRepository.save(existing)).thenReturn(existing);

        service.update(
                clubId, leagueId, seasonId, id,
                new UpdateLeagueTeamRequest("Riverside CC", "NEW", "/media/Riverside CC.png"));

        assertThat(existing.getAbbreviation()).isEqualTo("NEW");
        verify(matchRepository, never()).propagateLeagueTeamToHomeSide(any(), any(), any(), any());
        verify(matchRepository, never()).propagateLeagueTeamToAwaySide(any(), any(), any(), any());
    }

    @Test
    void updateWithADuplicateNameOfAnotherRowThrowsAndDoesNotPropagate() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(team(id, leagueId, seasonId, "A", true)));
        when(leagueTeamRepository.existsByLeagueIdAndSeasonIdAndNameIgnoreCaseAndIdNot(leagueId, seasonId, "B", id))
                .thenReturn(true);

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, id, new UpdateLeagueTeamRequest("B", null, null)))
                .isInstanceOf(DuplicateLeagueTeamNameException.class);
        verify(leagueTeamRepository, never()).save(any());
        verify(matchRepository, never()).propagateLeagueTeamToHomeSide(any(), any(), any(), any());
    }

    @Test
    void updateWithABlankNameThrowsValidationException() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(team(id, leagueId, seasonId, "A", true)));

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, id, new UpdateLeagueTeamRequest(" ", null, null)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void updateThrowsNotFoundWhenTheLeagueTeamSitsInAnotherSeasonOrLeague() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        when(leagueTeamRepository.findById(id))
                .thenReturn(Optional.of(team(id, leagueId, UUID.randomUUID(), "A", true)));

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, id, new UpdateLeagueTeamRequest("A", null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateThrowsNotFoundWhenTheLeagueTeamDoesNotExist() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, id, new UpdateLeagueTeamRequest("A", null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateThrowsNotFoundWhenTheSeasonBelongsToAnotherClub() {
        stubLeague(leagueId, clubId);
        stubSeason(seasonId, UUID.randomUUID());

        assertThatThrownBy(() -> service.update(
                        clubId, leagueId, seasonId, UUID.randomUUID(), new UpdateLeagueTeamRequest("A", null, null)))
                .isInstanceOf(NotFoundException.class);
        verify(leagueTeamRepository, never()).findById(any());
    }

    // --- deactivate / reactivate ---

    @Test
    void deactivateFlipsAnActiveTeamAndNeverTouchesMatches() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        LeagueTeam existing = team(id, leagueId, seasonId, "A", true);
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(existing));
        when(leagueTeamRepository.save(existing)).thenReturn(existing);

        LeagueTeamDto dto = service.deactivate(clubId, leagueId, seasonId, id);

        assertThat(dto.active()).isFalse();
        verify(matchRepository, never()).propagateLeagueTeamToHomeSide(any(), any(), any(), any());
    }

    @Test
    void deactivateAnAlreadyInactiveTeamThrowsInvalidStatusTransitionException() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(team(id, leagueId, seasonId, "A", false)));

        assertThatThrownBy(() -> service.deactivate(clubId, leagueId, seasonId, id))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateFlipsAnInactiveTeam() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        LeagueTeam existing = team(id, leagueId, seasonId, "A", false);
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(existing));
        when(leagueTeamRepository.save(existing)).thenReturn(existing);

        assertThat(service.reactivate(clubId, leagueId, seasonId, id).active()).isTrue();
    }

    @Test
    void reactivateAnAlreadyActiveTeamThrowsInvalidStatusTransitionException() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(team(id, leagueId, seasonId, "A", true)));

        assertThatThrownBy(() -> service.reactivate(clubId, leagueId, seasonId, id))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    // --- remove ---

    @Test
    void removeDeletesAnUnreferencedTeamAndReportsDeleted() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        LeagueTeam existing = team(id, leagueId, seasonId, "A", true);
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(existing));
        when(leagueTeamRepository.existsReference(id)).thenReturn(false);

        RemoveLeagueTeamResponse response = service.remove(clubId, leagueId, seasonId, id);

        assertThat(response.outcome()).isEqualTo(LeagueTeamRemoveOutcome.DELETED);
        assertThat(response.leagueTeam()).isNull();
        verify(leagueTeamRepository).delete(existing);
    }

    @Test
    void removeDeactivatesATeamReferencedByAHomeOrAwaySideAndReportsDeactivated() {
        stubLeagueAndSeasonOfThisClub();
        UUID id = UUID.randomUUID();
        LeagueTeam existing = team(id, leagueId, seasonId, "A", true);
        when(leagueTeamRepository.findById(id)).thenReturn(Optional.of(existing));
        // existsReference covers home OR away (its repository test proves both sides)
        when(leagueTeamRepository.existsReference(id)).thenReturn(true);
        when(leagueTeamRepository.save(existing)).thenReturn(existing);
        when(leagueTeamRepository.countReferencingMatches(List.of(id))).thenReturn(List.of(count(id, 1)));

        RemoveLeagueTeamResponse response = service.remove(clubId, leagueId, seasonId, id);

        assertThat(response.outcome()).isEqualTo(LeagueTeamRemoveOutcome.DEACTIVATED);
        assertThat(response.leagueTeam().active()).isFalse();
        assertThat(response.leagueTeam().referencedByMatchCount()).isEqualTo(1L);
        verify(leagueTeamRepository, never()).delete(any(LeagueTeam.class));
    }

    @Test
    void removeThrowsNotFoundWhenTheLeagueBelongsToAnotherClub() {
        stubLeague(leagueId, UUID.randomUUID());

        assertThatThrownBy(() -> service.remove(clubId, leagueId, seasonId, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }

    // --- copy ---

    private final UUID sourceLeagueId = UUID.randomUUID();
    private final UUID sourceSeasonId = UUID.randomUUID();

    private void stubCopyScope() {
        stubLeagueAndSeasonOfThisClub();
        stubLeague(sourceLeagueId, clubId);
        stubSeason(sourceSeasonId, clubId);
    }

    @Test
    void copyCreatesNewActiveRowsCarryingOnlyNameAbbreviationAndLogo() {
        stubCopyScope();
        UUID srcId = UUID.randomUUID();
        LeagueTeam source = team(srcId, sourceLeagueId, sourceSeasonId, "Riverside CC", false);
        when(leagueTeamRepository.findAllById(any())).thenReturn(List.of(source));
        when(leagueTeamRepository.findByLeagueAndSeason(leagueId, seasonId)).thenReturn(List.of());
        when(leagueTeamRepository.saveAll(anyIterable())).thenAnswer(i -> {
            List<LeagueTeam> saved = new ArrayList<>();
            i.<Iterable<LeagueTeam>>getArgument(0).forEach(saved::add);
            return saved;
        });

        CopyLeagueTeamsResponse response = service.copy(
                clubId, leagueId, seasonId, new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of(srcId)));

        ArgumentCaptor<Iterable<LeagueTeam>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(leagueTeamRepository).saveAll(captor.capture());
        LeagueTeam created = captor.getValue().iterator().next();
        assertThat(created.getId()).isNull();
        assertThat(created.getLeagueId()).isEqualTo(leagueId);
        assertThat(created.getSeasonId()).isEqualTo(seasonId);
        assertThat(created.getName()).isEqualTo("Riverside CC");
        assertThat(created.getAbbreviation()).isEqualTo("ABB");
        assertThat(created.getLogoUrl()).isEqualTo("/media/Riverside CC.png");
        assertThat(created.isActive()).isTrue();
        assertThat(response.created()).hasSize(1);
        assertThat(response.skipped()).isEmpty();
    }

    @Test
    void copySkipsNamesAlreadyInTheTargetAndWithinTheBatchCaseInsensitively() {
        stubCopyScope();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        when(leagueTeamRepository.findAllById(any())).thenReturn(List.of(
                team(a, sourceLeagueId, sourceSeasonId, "Riverside CC", true),
                team(b, sourceLeagueId, sourceSeasonId, "HILLSIDE cc", true),
                team(c, sourceLeagueId, sourceSeasonId, "hillside CC", true)));
        when(leagueTeamRepository.findByLeagueAndSeason(leagueId, seasonId))
                .thenReturn(List.of(team(UUID.randomUUID(), leagueId, seasonId, "riverside cc", false)));
        when(leagueTeamRepository.saveAll(anyIterable())).thenAnswer(i -> {
            List<LeagueTeam> saved = new ArrayList<>();
            i.<Iterable<LeagueTeam>>getArgument(0).forEach(saved::add);
            return saved;
        });

        CopyLeagueTeamsResponse response = service.copy(
                clubId, leagueId, seasonId, new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of(a, b, c)));

        assertThat(response.created()).extracting(LeagueTeamDto::name).containsExactly("HILLSIDE cc");
        assertThat(response.skipped()).extracting(s -> s.name() + "/" + s.reason())
                .containsExactly("Riverside CC/DUPLICATE_NAME", "hillside CC/DUPLICATE_NAME");
    }

    @Test
    void copyFromTheSameLeagueAndSeasonSkipsEveryRow() {
        stubLeagueAndSeasonOfThisClub();
        UUID a = UUID.randomUUID();
        LeagueTeam existing = team(a, leagueId, seasonId, "Riverside CC", true);
        when(leagueTeamRepository.findAllById(any())).thenReturn(List.of(existing));
        when(leagueTeamRepository.findByLeagueAndSeason(leagueId, seasonId)).thenReturn(List.of(existing));
        when(leagueTeamRepository.saveAll(anyIterable())).thenReturn(List.of());

        CopyLeagueTeamsResponse response = service.copy(
                clubId, leagueId, seasonId, new CopyLeagueTeamsRequest(leagueId, seasonId, List.of(a)));

        assertThat(response.created()).isEmpty();
        assertThat(response.skipped()).hasSize(1);
    }

    @Test
    void copyWithAnIdOutsideTheStatedSourceThrowsValidationExceptionAndCreatesNothing() {
        stubCopyScope();
        UUID inSource = UUID.randomUUID();
        UUID elsewhere = UUID.randomUUID();
        when(leagueTeamRepository.findAllById(any())).thenReturn(List.of(
                team(inSource, sourceLeagueId, sourceSeasonId, "A", true),
                team(elsewhere, UUID.randomUUID(), sourceSeasonId, "B", true)));

        assertThatThrownBy(() -> service.copy(
                        clubId, leagueId, seasonId,
                        new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of(inSource, elsewhere))))
                .isInstanceOf(ValidationException.class);
        verify(leagueTeamRepository, never()).saveAll(anyIterable());
    }

    @Test
    void copyWithAnUnknownIdThrowsValidationException() {
        stubCopyScope();
        when(leagueTeamRepository.findAllById(any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.copy(
                        clubId, leagueId, seasonId,
                        new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of(UUID.randomUUID()))))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void copyWithEmptyIdsThrowsValidationException() {
        stubCopyScope();

        assertThatThrownBy(() -> service.copy(
                        clubId, leagueId, seasonId, new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of())))
                .isInstanceOf(ValidationException.class);
        verify(leagueTeamRepository, never()).saveAll(anyIterable());
    }

    @Test
    void copyFromAnotherClubsLeagueThrowsNotFoundException() {
        stubLeagueAndSeasonOfThisClub();
        stubLeague(sourceLeagueId, UUID.randomUUID());

        assertThatThrownBy(() -> service.copy(
                        clubId, leagueId, seasonId,
                        new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of(UUID.randomUUID()))))
                .isInstanceOf(NotFoundException.class);
        verify(leagueTeamRepository, never()).saveAll(anyIterable());
    }

    @Test
    void copyFromAnotherClubsSeasonThrowsNotFoundException() {
        stubLeagueAndSeasonOfThisClub();
        stubLeague(sourceLeagueId, clubId);
        stubSeason(sourceSeasonId, UUID.randomUUID());

        assertThatThrownBy(() -> service.copy(
                        clubId, leagueId, seasonId,
                        new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of(UUID.randomUUID()))))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void copyIntoAnotherClubsLeagueThrowsNotFoundException() {
        stubLeague(leagueId, UUID.randomUUID());

        assertThatThrownBy(() -> service.copy(
                        clubId, leagueId, seasonId,
                        new CopyLeagueTeamsRequest(sourceLeagueId, sourceSeasonId, List.of(UUID.randomUUID()))))
                .isInstanceOf(NotFoundException.class);
    }
}
