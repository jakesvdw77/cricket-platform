package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.exception.FieldRejectedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayingAreaNotMatchableException;
import com.cricketlegend.repository.PlayingAreaRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** docs/specs/099-fields-directory.md: a rejected, merged-away or non-cricket-field id is refused / resolved. */
@ExtendWith(MockitoExtension.class)
class PlayingAreaMatchResolverTest {

    @Mock
    private PlayingAreaRepository playingAreaRepository;

    @InjectMocks
    private PlayingAreaMatchResolver resolver;

    private PlayingArea area(PlayingAreaVerificationStatus status, UUID mergedInto) {
        PlayingArea area = PlayingArea.builder()
                .id(UUID.randomUUID())
                .areaType(PlayingAreaType.CRICKET_FIELD)
                .name("Oval")
                .verificationStatus(status)
                .mergedIntoId(mergedInto)
                .build();
        when(playingAreaRepository.findById(area.getId())).thenReturn(Optional.of(area));
        return area;
    }

    @Test
    void unverifiedAndVerifiedFieldsResolveToThemselves() {
        PlayingArea unverified = area(PlayingAreaVerificationStatus.UNVERIFIED, null);
        PlayingArea verified = area(PlayingAreaVerificationStatus.VERIFIED, null);

        assertThat(resolver.resolveForMatch(unverified.getId())).isSameAs(unverified);
        assertThat(resolver.resolveForMatch(verified.getId())).isSameAs(verified);
    }

    @Test
    void rejectedFieldIsRefused() {
        PlayingArea rejected = area(PlayingAreaVerificationStatus.REJECTED, null);

        assertThatThrownBy(() -> resolver.resolveForMatch(rejected.getId())).isInstanceOf(FieldRejectedException.class);
    }

    @Test
    void nonCricketFieldIsRefused() {
        PlayingArea notAField = area(PlayingAreaVerificationStatus.VERIFIED, null);
        notAField.setAreaType(null); // the enum only has CRICKET_FIELD today; step 2 adds more

        assertThatThrownBy(() -> resolver.resolveForMatch(notAField.getId()))
                .isInstanceOf(PlayingAreaNotMatchableException.class);
    }

    @Test
    void mergedAwayIdResolvesToTheSurvivor() {
        PlayingArea survivor = area(PlayingAreaVerificationStatus.VERIFIED, null);
        PlayingArea middle = area(PlayingAreaVerificationStatus.UNVERIFIED, survivor.getId());
        PlayingArea first = area(PlayingAreaVerificationStatus.UNVERIFIED, middle.getId());

        assertThat(resolver.resolveForMatch(first.getId())).isSameAs(survivor);
        assertThat(resolver.follow(first.getId())).isSameAs(survivor);
    }

    @Test
    void mergedIntoARejectedSurvivorIsRefused() {
        PlayingArea survivor = area(PlayingAreaVerificationStatus.REJECTED, null);
        PlayingArea merged = area(PlayingAreaVerificationStatus.UNVERIFIED, survivor.getId());

        assertThatThrownBy(() -> resolver.resolveForMatch(merged.getId())).isInstanceOf(FieldRejectedException.class);
    }

    @Test
    void unknownIdIsNotFound() {
        UUID id = UUID.randomUUID();
        when(playingAreaRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolver.resolveForMatch(id)).isInstanceOf(NotFoundException.class);
    }
}
