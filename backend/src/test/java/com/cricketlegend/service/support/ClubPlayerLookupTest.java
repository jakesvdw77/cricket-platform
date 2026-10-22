package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.PlayerProfileRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The tenancy check every player statistics read starts with: unknown or other-club is a 404. */
class ClubPlayerLookupTest {

    private final PlayerProfileRepository repository = mock(PlayerProfileRepository.class);
    private final ClubPlayerLookup lookup = new ClubPlayerLookup(repository);
    private final UUID clubId = UUID.randomUUID();
    private final UUID playerId = UUID.randomUUID();

    @Test
    void aPlayerOfTheClubIsReturned() {
        PlayerProfile player = PlayerProfile.builder().id(playerId).clubId(clubId).build();
        when(repository.findById(playerId)).thenReturn(Optional.of(player));

        assertThat(lookup.require(clubId, playerId)).isSameAs(player);
    }

    @Test
    void anUnknownPlayerIsNotFound() {
        when(repository.findById(playerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> lookup.require(clubId, playerId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void aPlayerOfAnotherClubIsNotFoundNotForbidden() {
        when(repository.findById(playerId))
                .thenReturn(Optional.of(PlayerProfile.builder().id(playerId).clubId(UUID.randomUUID()).build()));

        assertThatThrownBy(() -> lookup.require(clubId, playerId)).isInstanceOf(NotFoundException.class);
    }
}
