package com.cricketlegend.service;

import com.cricketlegend.dto.MyClubContactPageDto;
import com.cricketlegend.dto.MyClubInfoDto;
import org.springframework.security.core.Authentication;

/** docs/specs/148-player-hub-club-info.md: the read-only Club info of the club of a player the caller holds. */
public interface MyClubInfoService {

    /**
     * The page without the directory rows. Throws {@link com.cricketlegend.exception.NotFoundException} for a key the
     * caller does not hold.
     */
    MyClubInfoDto info(Authentication authentication, String playerKey);

    /**
     * One page of the club's active contacts. {@link com.cricketlegend.exception.NotFoundException} (404) for a player
     * not held, for a junior's own login and for a directory that is switched off;
     * {@link com.cricketlegend.exception.ValidationException} (400) for a bad parameter. Null parameters take the defaults
     * (sort {@code name}, page 0, size 25).
     */
    MyClubContactPageDto contacts(
            Authentication authentication, String playerKey, String query, String sort, String letter, Integer page, Integer size);
}
