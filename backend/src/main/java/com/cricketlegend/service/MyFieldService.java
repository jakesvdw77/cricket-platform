package com.cricketlegend.service;

import com.cricketlegend.dto.MyFieldDto;
import java.util.List;
import org.springframework.security.core.Authentication;

/** docs/specs/121: the read-only Field Directory for a player the caller holds (My players, docs/specs/119). */
public interface MyFieldService {

    /** The home and current-season away fields of the held player's club; a 404 for a key the caller does not hold. */
    List<MyFieldDto> list(Authentication authentication, String playerKey);
}
