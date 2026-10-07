package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.dto.AvailabilitySummaryDto;
import com.cricketlegend.dto.OverviewPollDto;
import com.cricketlegend.service.AvailabilitySummaryService;
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
 * so {@code answersAwaited} equals the overview's by construction. A poll is closing soon when its
 * close time is after now and at most 48 hours away.
 */
@Service
public class AvailabilitySummaryServiceImpl implements AvailabilitySummaryService {

    static final Duration CLOSING_SOON = Duration.ofHours(48);

    private final OverviewPolls overviewPolls;
    private final AccessService accessService;
    private final Clock clock;

    public AvailabilitySummaryServiceImpl(OverviewPolls overviewPolls, AccessService accessService, Clock clock) {
        this.overviewPolls = overviewPolls;
        this.accessService = accessService;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public AvailabilitySummaryDto summary(Authentication authentication, UUID clubId) {
        Optional<Set<UUID>> accessible = accessService.accessibleSectionIds(authentication, clubId);
        if (accessible.isPresent() && accessible.get().isEmpty()) {
            return new AvailabilitySummaryDto(0, 0, 0, 0, 0);
        }
        List<OpenPoll> polls = overviewPolls.openPollsWithPlayers(clubId, accessible);
        Instant now = clock.instant();
        Instant horizon = now.plus(CLOSING_SOON);
        Set<UUID> audience = new HashSet<>();
        Set<UUID> responded = new HashSet<>();
        long answersAwaited = 0;
        int closingSoon = 0;
        for (OpenPoll open : polls) {
            OverviewPollDto poll = open.poll();
            audience.addAll(open.audience());
            responded.addAll(open.responded());
            answersAwaited += Math.max(0, poll.totalCount() - poll.repliedCount());
            Instant closeAt = poll.scheduledCloseAt();
            if (closeAt != null && closeAt.isAfter(now) && !closeAt.isAfter(horizon)) {
                closingSoon++;
            }
        }
        responded.retainAll(audience);
        return new AvailabilitySummaryDto(polls.size(), responded.size(), audience.size(), answersAwaited, closingSoon);
    }
}
