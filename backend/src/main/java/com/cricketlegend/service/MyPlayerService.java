package com.cricketlegend.service;

import com.cricketlegend.dto.MyPlayerDto;
import com.cricketlegend.dto.MyPlayerSummaryDto;
import com.cricketlegend.dto.UpdateMyPlayerRequest;
import java.util.List;
import org.springframework.security.core.Authentication;

/** docs/specs/119 "My players": what a linked account (or the player) sees and maintains. Authorised only from the caller's own rows. */
public interface MyPlayerService {

    /** The caller's own record first, then linked players. */
    List<MyPlayerSummaryDto> list(Authentication authentication);

    /** 404 for a key the caller does not hold. */
    MyPlayerDto get(Authentication authentication, String key);

    /** The whitelist update; medical aid needs the main agent or the adult player (403 otherwise). */
    MyPlayerDto update(Authentication authentication, String key, UpdateMyPlayerRequest request);
}
