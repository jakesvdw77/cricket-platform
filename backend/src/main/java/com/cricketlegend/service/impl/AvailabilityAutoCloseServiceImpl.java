package com.cricketlegend.service.impl;

import com.cricketlegend.service.AvailabilityAutoCloseService;
import com.cricketlegend.service.MatchAvailabilityPollService;
import com.cricketlegend.service.SectionAvailabilityRoundService;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Plain {@code @Scheduled} fixed-delay job (default every 5 minutes, {@code
 * cricketlegend.autoclose.fixed-delay} as an ISO-8601 duration), gated by {@code
 * cricketlegend.autoclose.enabled} (checked per tick, so the bean always exists and {@link
 * #closeDuePolls} stays directly callable from tests). Delegates to each poll service's own transactional, auth-free
 * close method so a group poll still cascades to every window.
 */
@Service
public class AvailabilityAutoCloseServiceImpl implements AvailabilityAutoCloseService {

    private static final Logger log = LoggerFactory.getLogger(AvailabilityAutoCloseServiceImpl.class);

    private final MatchAvailabilityPollService matchAvailabilityPollService;
    private final SectionAvailabilityRoundService sectionAvailabilityRoundService;
    private final boolean enabled;

    public AvailabilityAutoCloseServiceImpl(
            MatchAvailabilityPollService matchAvailabilityPollService,
            SectionAvailabilityRoundService sectionAvailabilityRoundService,
            @Value("${cricketlegend.autoclose.enabled:true}") boolean enabled) {
        this.matchAvailabilityPollService = matchAvailabilityPollService;
        this.sectionAvailabilityRoundService = sectionAvailabilityRoundService;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${cricketlegend.autoclose.fixed-delay:PT5M}")
    public void runScheduled() {
        if (!enabled) {
            return;
        }
        try {
            closeDuePolls(Instant.now());
        } catch (RuntimeException e) {
            // A failed run must not cancel the schedule; the next tick retries.
            log.error("Availability auto-close run failed", e);
        }
    }

    @Override
    public int closeDuePolls(Instant now) {
        int squad = matchAvailabilityPollService.closeDueAutoClosePolls(now);
        int group = sectionAvailabilityRoundService.closeDueAutoClosePolls(now);
        if (squad + group > 0) {
            log.info("Availability auto-close: closed {} squad poll(s) and {} group poll(s)", squad, group);
        } else {
            log.debug("Availability auto-close: nothing due");
        }
        return squad + group;
    }
}
