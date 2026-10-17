package com.cricketlegend.service.impl;

import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.dto.LeagueSeasonDatesDto;
import com.cricketlegend.dto.UpdateLeagueSeasonDatesRequest;
import com.cricketlegend.exception.LeagueDatesExcludeMatchesException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueSeasonMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueSeasonRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.OutsideDatesSummary;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.LeagueSeasonDatesService;
import com.cricketlegend.service.support.LeagueSeasonAccessValidation;
import com.cricketlegend.service.support.LeagueSeasonDates;
import com.cricketlegend.service.support.ServerClock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/111-league-season-dates.md: the dates are an upsert on the unique {@code (league_id, season_id)} key. The
 * dates may not exclude an active match of the league in the season; the check is one aggregate query on the matches'
 * instants, bounded by the start of the first day and the start of the day after the last day on the server clock.
 */
@Service
public class LeagueSeasonDatesServiceImpl implements LeagueSeasonDatesService {

    private final LeagueRepository leagueRepository;
    private final SeasonRepository seasonRepository;
    private final LeagueSeasonRepository leagueSeasonRepository;
    private final MatchRepository matchRepository;
    private final LeagueSeasonMapper leagueSeasonMapper;

    public LeagueSeasonDatesServiceImpl(
            LeagueRepository leagueRepository,
            SeasonRepository seasonRepository,
            LeagueSeasonRepository leagueSeasonRepository,
            MatchRepository matchRepository,
            LeagueSeasonMapper leagueSeasonMapper) {
        this.leagueRepository = leagueRepository;
        this.seasonRepository = seasonRepository;
        this.leagueSeasonRepository = leagueSeasonRepository;
        this.matchRepository = matchRepository;
        this.leagueSeasonMapper = leagueSeasonMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public LeagueSeasonDatesDto get(UUID clubId, UUID leagueId, UUID seasonId) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        return leagueSeasonRepository
                .findByLeagueIdAndSeasonId(leagueId, seasonId)
                .map(leagueSeasonMapper::toDto)
                .orElseThrow(() -> new NotFoundException("Season dates not set"));
    }

    @Override
    @Transactional
    public LeagueSeasonDatesDto update(
            UUID clubId, UUID leagueId, UUID seasonId, UpdateLeagueSeasonDatesRequest request, UUID updatedBy) {
        validateLeagueAndSeason(clubId, leagueId, seasonId);
        if (request.startDate() == null || request.endDate() == null) {
            throw new ValidationException("startDate and endDate are required");
        }
        if (request.startDate().isAfter(request.endDate())) {
            throw new ValidationException("startDate must not be after endDate");
        }
        OutsideDatesSummary outside = matchRepository.summariseOutsideDates(
                leagueId,
                seasonId,
                ServerClock.startOfDay(request.startDate()),
                ServerClock.startOfDay(request.endDate().plusDays(1)));
        if (outside.getMatchCount() > 0) {
            throw new LeagueDatesExcludeMatchesException(excludeMessage(
                    outside.getMatchCount(), outside.getEarliest(), outside.getLatest()));
        }
        LeagueSeason dates = leagueSeasonRepository
                .findByLeagueIdAndSeasonId(leagueId, seasonId)
                .orElseGet(() -> LeagueSeason.builder().leagueId(leagueId).seasonId(seasonId).build());
        dates.setStartDate(request.startDate());
        dates.setEndDate(request.endDate());
        dates.setUpdatedBy(updatedBy);
        return leagueSeasonMapper.toDto(leagueSeasonRepository.save(dates));
    }

    private static String excludeMessage(long count, Instant earliest, Instant latest) {
        String subject = count == 1 ? "1 match" : count + " matches";
        String verb = count == 1 ? "falls" : "fall";
        if (count == 1) {
            return subject + " of this league " + verb + " outside these dates (on " + LeagueSeasonDates.format(earliest) + ").";
        }
        return subject + " of this league " + verb + " outside these dates (the earliest on "
                + LeagueSeasonDates.format(earliest) + ", the latest on " + LeagueSeasonDates.format(latest) + ").";
    }

    private void validateLeagueAndSeason(UUID clubId, UUID leagueId, UUID seasonId) {
        LeagueSeasonAccessValidation.assertLeagueBelongsToClub(leagueRepository, leagueId, clubId);
        LeagueSeasonAccessValidation.assertSeasonBelongsToClub(seasonRepository, seasonId, clubId);
    }
}
