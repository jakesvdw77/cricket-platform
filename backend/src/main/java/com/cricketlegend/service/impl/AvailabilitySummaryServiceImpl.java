package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.service.AvailabilitySummaryService;
import com.cricketlegend.service.support.AvailabilityPollFilter;
import com.cricketlegend.service.support.AvailabilityPollFilters;
import com.cricketlegend.service.support.OverviewPolls;
import com.cricketlegend.service.support.OverviewPolls.OpenPoll;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/081-plain-page-header-and-counters.md. Reads the very polls the manager overview
 * does, through {@link OverviewPolls} and the same {@link AccessService#accessibleSectionIds} scope,
 * so with no filter its polls are the overview's by construction. The optional filters of
 * docs/specs/083-availability-filters-and-toolbars.md come from {@link AvailabilityPollFilters}.
 * {@code playersStillToAnswer} counts distinct players. An open poll is closing soon when its close
 * time is after now and at most 48 hours away.
 */
@Service
public class AvailabilitySummaryServiceImpl implements AvailabilitySummaryService {

    static final Duration CLOSING_SOON = Duration.ofHours(48);

    private final OverviewPolls overviewPolls;
    private final AccessService accessService;
    private final AvailabilityPollFilters pollFilters;
    private final Clock clock;

    public AvailabilitySummaryServiceImpl(
            OverviewPolls overviewPolls, AccessService accessService, AvailabilityPollFilters pollFilters, Clock clock) {
        this.overviewPolls = overviewPolls;
        this.accessService = accessService;
        this.pollFilters = pollFilters;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public AvailabilitySummaryDto summary(
            Authentication authentication,
            UUID clubId,
            UUID leagueId,
            UUID sectionId,
            UUID teamId,
            AvailabilityPollTypeFilter type,
            boolean includeClosed) {
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        // Validate the filter ids first so a bad id is a 404/403 even for a caller with no sections.
        AvailabilityPollFilter filter = pollFilters.resolve(
                authentication, clubId, accessible, leagueId, sectionId, teamId, type, includeClosed);
        if (accessible.isPresent() && accessible.get().isEmpty()) {
            return new AvailabilitySummaryDto(0, 0, 0, 0, 0);
        }
        List<OpenPoll> polls = overviewPolls.pollsWithPlayers(clubId, accessible, filter);
        Instant now = clock.instant();
        Instant horizon = now.plus(CLOSING_SOON);
        Set<UUID> audience = new HashSet<>();
        Set<UUID> responded = new HashSet<>();
        Set<UUID> stillToAnswer = new HashSet<>();
        int closingSoon = 0;
        for (OpenPoll shown : polls) {
            audience.addAll(shown.audience());
            responded.addAll(shown.responded());
            stillToAnswer.addAll(shown.awaiting());
            Instant closeAt = shown.poll().scheduledCloseAt();
            if (shown.open() && closeAt != null && closeAt.isAfter(now) && !closeAt.isAfter(horizon)) {
                closingSoon++;
            }
        }
        responded.retainAll(audience);
        return new AvailabilitySummaryDto(
                polls.size(), responded.size(), audience.size(), stillToAnswer.size(), closingSoon);
    }
}
