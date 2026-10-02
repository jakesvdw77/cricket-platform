package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.service.impl.AvailabilityAutoCloseServiceImpl;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for AvailabilityAutoCloseServiceImpl (docs/specs/064-unified-availability-polls.md):
 * the enabled flag gates the scheduled run, a failing delegate never escapes the scheduler thread,
 * and {@code closeDuePolls} sums squad and group closes.
 */
@ExtendWith(MockitoExtension.class)
class AvailabilityAutoCloseServiceImplTest {

    @Mock
    private MatchAvailabilityPollService matchAvailabilityPollService;

    @Mock
    private SectionAvailabilityRoundService sectionAvailabilityRoundService;

    private AvailabilityAutoCloseServiceImpl service(boolean enabled) {
        return new AvailabilityAutoCloseServiceImpl(
                matchAvailabilityPollService, sectionAvailabilityRoundService, enabled);
    }

    @Test
    void runScheduledMakesNoDelegateCallsWhenAutoCloseIsDisabled() {
        service(false).runScheduled();

        verifyNoInteractions(matchAvailabilityPollService, sectionAvailabilityRoundService);
    }

    @Test
    void runScheduledDelegatesToBothServicesWhenEnabled() {
        when(matchAvailabilityPollService.closeDueAutoClosePolls(any())).thenReturn(1);
        when(sectionAvailabilityRoundService.closeDueAutoClosePolls(any())).thenReturn(0);

        service(true).runScheduled();

        org.mockito.Mockito.verify(matchAvailabilityPollService).closeDueAutoClosePolls(any());
        org.mockito.Mockito.verify(sectionAvailabilityRoundService).closeDueAutoClosePolls(any());
    }

    @Test
    void anExceptionFromADelegateDoesNotPropagateOutOfRunScheduled() {
        when(matchAvailabilityPollService.closeDueAutoClosePolls(any())).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> service(true).runScheduled()).doesNotThrowAnyException();
    }

    @Test
    void closeDuePollsReturnsSquadCountPlusGroupCount() {
        Instant now = Instant.parse("2026-10-02T12:00:00Z");
        when(matchAvailabilityPollService.closeDueAutoClosePolls(now)).thenReturn(3);
        when(sectionAvailabilityRoundService.closeDueAutoClosePolls(now)).thenReturn(2);

        assertThat(service(true).closeDuePolls(now)).isEqualTo(5);
    }
}
