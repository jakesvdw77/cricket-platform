package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.impl.MyPlayerPollHistoryServiceImpl;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

/** Parameter validation is decided before any read; the access check comes first. */
class MyPlayerPollHistoryServiceImplTest {

    private final MyPlayerAccess access = mock(MyPlayerAccess.class);
    private final Authentication auth = mock(Authentication.class);
    private final MyPlayerPollHistoryServiceImpl service = new MyPlayerPollHistoryServiceImpl(
            access, null, null, null, null, null, null, null, null, null, null, null);

    @Test
    void anUnheldPlayerIsNotFoundBeforeAnythingIsValidated() {
        when(access.resolve(any(), any())).thenThrow(new NotFoundException("Player not found"));
        assertThatThrownBy(() -> service.closed(auth, "k", 0, "bogus")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.responses(auth, "k", null, "bogus")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void sinceDaysOutsideOneToThreeSixtyFiveAndAnUnknownStatusAreRefused() {
        PlayerProfile profile = PlayerProfile.builder().id(UUID.randomUUID()).clubId(UUID.randomUUID()).build();
        when(access.resolve(any(), any())).thenReturn(new HeldPlayer("k", null, null, profile, null));
        assertThatThrownBy(() -> service.closed(auth, "k", 0, null)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.closed(auth, "k", 366, null)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.closed(auth, "k", 30, "MAYBE")).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.responses(auth, "k", null, "available")).isInstanceOf(ValidationException.class);
    }
}
