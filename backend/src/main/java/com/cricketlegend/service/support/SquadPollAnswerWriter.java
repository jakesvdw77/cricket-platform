package com.cricketlegend.service.support;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.exception.PollClosedException;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The one place a squad poll answer is written for a player (docs/specs/077, docs/specs/119): the closed check
 * (409) and the upsert, with the caller's {@link AnswerSource}. Who may answer (a verified public token, or a linked
 * account) is decided by the caller before this runs.
 */
@Component
public class SquadPollAnswerWriter {

    private final PlayerAvailabilityRepository playerAvailabilityRepository;

    public SquadPollAnswerWriter(PlayerAvailabilityRepository playerAvailabilityRepository) {
        this.playerAvailabilityRepository = playerAvailabilityRepository;
    }

    public PlayerAvailability save(
            MatchAvailabilityPoll poll, UUID playerId, AvailabilityStatus status, AnswerSource source) {
        if (!poll.isOpen()) {
            throw new PollClosedException("Poll is closed: " + poll.getId());
        }
        PlayerAvailability availability = playerAvailabilityRepository
                .findByPollIdAndPlayerProfileId(poll.getId(), playerId)
                .orElseGet(() -> PlayerAvailability.builder()
                        .pollId(poll.getId())
                        .playerProfileId(playerId)
                        .build());
        availability.setStatus(status);
        availability.setSource(source);
        return playerAvailabilityRepository.save(availability);
    }
}
