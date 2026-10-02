package com.cricketlegend.repository;

import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Small, bounded, unpaginated — same {@code TeamServiceImpl.listByClub}-style in-memory-filter
 * precedent as every other flat club-scoped list in this feature area. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public interface SectionAvailabilityWindowRepository extends JpaRepository<SectionAvailabilityWindow, UUID> {

    Optional<SectionAvailabilityWindow> findBySectionIdAndWindowDateAndDayPart(
            UUID sectionId, LocalDate windowDate, DayPart dayPart);

    boolean existsBySectionIdAndWindowDateAndDayPart(UUID sectionId, LocalDate windowDate, DayPart dayPart);

    List<SectionAvailabilityWindow> findByClubId(UUID clubId);

    /**
     * Every bracket owned by one {@code SectionAvailabilityRound} — however many that is per the
     * fixture-group-selection revision (one per distinct bracket among the round's own selected
     * matches, no longer always exactly two). Every {@code dayPart}-keyed lookup this codebase
     * used before that revision ({@code findByRoundIdAndDayPart}) is gone — a round can now own
     * several windows sharing the same {@code dayPart} across different dates, so a specific
     * bracket is only ever addressed by its own {@code windowId} from here on.
     */
    List<SectionAvailabilityWindow> findByRoundId(UUID roundId);

    /** Batched {@link #findByRoundId} for the group-poll list (docs/specs/066): one query for many rounds. */
    List<SectionAvailabilityWindow> findByRoundIdIn(Collection<UUID> roundIds);

    void deleteByRoundId(UUID roundId);
}
