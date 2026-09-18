package com.cricketlegend.repository;

import com.cricketlegend.domain.PlayerAvailability;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** See docs/specs/032-match-availability-polls.md. */
public interface PlayerAvailabilityRepository extends JpaRepository<PlayerAvailability, UUID> {

    List<PlayerAvailability> findByPollId(UUID pollId);

    Optional<PlayerAvailability> findByPollIdAndPlayerProfileId(UUID pollId, UUID playerProfileId);
}
