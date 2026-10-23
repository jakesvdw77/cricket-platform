package com.cricketlegend.service;

import com.cricketlegend.dto.MyPollDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/119: the open availability polls a held player belongs to (exactly "belonging to the poll" in 077) and
 * saving their answers through the shared 077 writers with {@code source = LINKED_ACCOUNT}. No date of birth challenge:
 * the authenticated link is the proof.
 */
public interface MyPlayerPollService {

    /** Open squad polls and open group rounds the player belongs to, with their current answers. */
    List<MyPollDto> list(Authentication authentication, String key);

    /** 404 when the poll does not exist or the player does not belong to it, 409 when it is closed. */
    PublicAnswersDto saveAnswers(Authentication authentication, String key, UUID pollId, PublicAnswersRequest request);
}
