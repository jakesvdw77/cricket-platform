package com.cricketlegend.service;

import com.cricketlegend.dto.MyFieldDto;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** docs/specs/121: the read-only Field Directory for a player the caller holds (My players, docs/specs/119). */
public interface MyFieldService {

    /** The home and current-season away fields of the held player's club; a 404 for a key the caller does not hold. */
    List<MyFieldDto> list(Authentication authentication, String playerKey);

    /**
     * The same rows as {@link #list} for the given playing-area ids of a club (merge-followed, ineligible rows dropped,
     * free-text venues simply absent from {@code playingAreaIds}), sorted by name. No access check: callers authorise.
     */
    List<MyFieldDto> describe(UUID clubId, Collection<UUID> playingAreaIds);
}
