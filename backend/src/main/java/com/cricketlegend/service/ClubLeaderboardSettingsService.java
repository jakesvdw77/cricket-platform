package com.cricketlegend.service;

import com.cricketlegend.dto.LeaderboardSettingsDto;
import com.cricketlegend.service.support.LeaderboardBoard;
import java.util.List;
import java.util.UUID;

/** A club's leaderboard settings: which award categories the Awards view shows. See docs/specs/103-player-stats.md, decision 18. */
public interface ClubLeaderboardSettingsService {

    /**
     * The effective settings: the club's saved categories, or the nine defaults when it has not chosen (or has no
     * profile row yet). Throws {@link com.cricketlegend.exception.NotFoundException} when the club does not exist.
     */
    LeaderboardSettingsDto get(UUID clubId);

    /**
     * Saves the chosen categories (in catalogue order, duplicates dropped), creating the club's profile row when there
     * is none. An empty or missing list, an unknown code or a board that is not award-eligible is a {@link
     * com.cricketlegend.exception.ValidationException}. Throws {@link com.cricketlegend.exception.NotFoundException}
     * when the club does not exist.
     */
    LeaderboardSettingsDto put(UUID clubId, LeaderboardSettingsDto settings);

    /** The effective categories as boards, in catalogue order: what the Awards view shows. */
    List<LeaderboardBoard> awardBoards(UUID clubId);
}
