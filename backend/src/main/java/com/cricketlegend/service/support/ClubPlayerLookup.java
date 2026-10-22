package com.cricketlegend.service.support;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.PlayerProfileRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The tenancy check every player statistics read starts with: an unknown player, or one of another club, is a 404. Shared by
 * the Dashboard service so that rule is read from one place.
 */
@Component
public class ClubPlayerLookup {

    private final PlayerProfileRepository playerProfileRepository;

    public ClubPlayerLookup(PlayerProfileRepository playerProfileRepository) {
        this.playerProfileRepository = playerProfileRepository;
    }

    public PlayerProfile require(UUID clubId, UUID playerId) {
        return playerProfileRepository
                .findById(playerId)
                .filter(player -> clubId.equals(player.getClubId()))
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
    }
}
