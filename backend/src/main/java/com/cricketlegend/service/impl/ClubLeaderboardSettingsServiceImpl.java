package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.LeaderboardSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.ClubLeaderboardSettingsService;
import com.cricketlegend.service.support.LeaderboardBoard;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/103-player-stats.md, decision 18: the choice lives on {@code club_profile.leaderboard_award_categories} but
 * is written only here, never by the profile form, so a profile save cannot reset it and this save cannot touch the
 * profile's other columns (the same shape as {@link ClubShareSettingsServiceImpl}).
 */
@Service
public class ClubLeaderboardSettingsServiceImpl implements ClubLeaderboardSettingsService {

    private final ClubRepository clubRepository;
    private final ClubProfileRepository clubProfileRepository;

    public ClubLeaderboardSettingsServiceImpl(
            ClubRepository clubRepository, ClubProfileRepository clubProfileRepository) {
        this.clubRepository = clubRepository;
        this.clubProfileRepository = clubProfileRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public LeaderboardSettingsDto get(UUID clubId) {
        return toDto(awardBoards(clubId));
    }

    @Override
    @Transactional
    public LeaderboardSettingsDto put(UUID clubId, LeaderboardSettingsDto settings) {
        requireClub(clubId);
        List<String> requested = settings == null ? null : settings.awardCategories();
        if (requested == null || requested.isEmpty()) {
            throw new ValidationException("Choose at least one award category.");
        }
        Set<LeaderboardBoard> chosen = new HashSet<>();
        for (String code : requested) {
            LeaderboardBoard board = LeaderboardBoard.byCode(code)
                    .orElseThrow(() -> new ValidationException("Unknown award category: " + code));
            if (!board.isAwardEligible()) {
                throw new ValidationException("Not an award category: " + code);
            }
            chosen.add(board);
        }
        List<String> codes = LeaderboardBoard.awardEligibleBoards().stream()
                .filter(chosen::contains)
                .map(LeaderboardBoard::getCode)
                .toList();
        ClubProfile profile = clubProfileRepository.findById(clubId).orElseGet(() -> {
            ClubProfile created = new ClubProfile();
            created.setClubId(clubId);
            return created;
        });
        profile.setLeaderboardAwardCategories(codes);
        clubProfileRepository.save(profile);
        return toDto(boardsOf(codes));
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaderboardBoard> awardBoards(UUID clubId) {
        requireClub(clubId);
        Optional<List<String>> saved =
                clubProfileRepository.findById(clubId).map(ClubProfile::getLeaderboardAwardCategories);
        List<LeaderboardBoard> boards = saved.map(ClubLeaderboardSettingsServiceImpl::boardsOf).orElse(List.of());
        return boards.isEmpty() ? LeaderboardBoard.awardDefaults() : boards;
    }

    /** The saved codes as eligible boards in catalogue order; a code that no longer exists is dropped. */
    private static List<LeaderboardBoard> boardsOf(List<String> codes) {
        if (codes == null) {
            return List.of();
        }
        return LeaderboardBoard.awardEligibleBoards().stream()
                .filter(board -> codes.contains(board.getCode()))
                .toList();
    }

    private static LeaderboardSettingsDto toDto(List<LeaderboardBoard> boards) {
        return new LeaderboardSettingsDto(
                boards.stream().map(LeaderboardBoard::getCode).toList(),
                LeaderboardBoard.awardEligibleBoards().stream().map(LeaderboardBoard::getCode).toList());
    }

    private void requireClub(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }
}
