package com.cricketlegend.service.impl;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.SectionMapper;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.PlayerSectionService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/028-players.md: {@code list}/{@code link}/{@code unlink} resolve
 * {@code playerId} belongs to {@code clubId} first ({@link #findPlayerOrThrowForClub}), THEN,
 * only once that parent-scope check passes, independently validate {@code sectionId} against
 * {@code clubId} ({@link #findSectionOrThrowForClub}, mirrors {@code
 * SponsorServiceImpl.findOrThrowForClub}'s idiom) — a cross-club parent 404s without ever
 * querying the section, exact same shape as {@code TeamSponsorServiceImpl}. {@code link} throws
 * {@link ConflictException} if already tagged; {@code unlink} throws {@link NotFoundException} if
 * no such tag exists and is always a hard delete of the join row.
 */
@Service
public class PlayerSectionServiceImpl implements PlayerSectionService {

    private final PlayerProfileRepository playerProfileRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final SectionRepository sectionRepository;
    private final SectionMapper sectionMapper;

    public PlayerSectionServiceImpl(
            PlayerProfileRepository playerProfileRepository,
            PlayerSectionRepository playerSectionRepository,
            SectionRepository sectionRepository,
            SectionMapper sectionMapper) {
        this.playerProfileRepository = playerProfileRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.sectionRepository = sectionRepository;
        this.sectionMapper = sectionMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SectionDto> list(UUID clubId, UUID playerId) {
        findPlayerOrThrowForClub(clubId, playerId);

        return playerSectionRepository.findByPlayerProfileId(playerId).stream()
                .map(link -> sectionRepository
                        .findById(link.getSectionId())
                        .orElseThrow(
                                () -> new NotFoundException("Section not found: " + link.getSectionId())))
                .map(sectionMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public void link(UUID clubId, UUID playerId, UUID sectionId) {
        findPlayerOrThrowForClub(clubId, playerId);
        findSectionOrThrowForClub(clubId, sectionId);

        if (playerSectionRepository.existsByPlayerProfileIdAndSectionId(playerId, sectionId)) {
            throw new ConflictException(
                    "Section " + sectionId + " is already tagged to player " + playerId);
        }

        PlayerSection link = PlayerSection.builder()
                .playerProfileId(playerId)
                .sectionId(sectionId)
                .build();
        playerSectionRepository.save(link);
    }

    @Override
    @Transactional
    public void unlink(UUID clubId, UUID playerId, UUID sectionId) {
        findPlayerOrThrowForClub(clubId, playerId);

        playerSectionRepository
                .findByPlayerProfileIdAndSectionId(playerId, sectionId)
                .orElseThrow(() -> new NotFoundException(
                        "No tag between player " + playerId + " and section " + sectionId));

        playerSectionRepository.deleteByPlayerProfileIdAndSectionId(playerId, sectionId);
    }

    /**
     * 404s when {@code playerId} doesn't exist at all, or exists but belongs to a different
     * club — mirrors {@code PlayerServiceImpl.findOrThrowForClub}.
     */
    private PlayerProfile findPlayerOrThrowForClub(UUID clubId, UUID playerId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        if (!profile.getClubId().equals(clubId)) {
            throw new NotFoundException("Player not found: " + playerId);
        }
        return profile;
    }

    /**
     * 404s when {@code sectionId} doesn't exist at all, or exists but belongs to a different
     * club — mirrors {@code SponsorServiceImpl.findOrThrowForClub}.
     */
    private Section findSectionOrThrowForClub(UUID clubId, UUID sectionId) {
        Section section = sectionRepository
                .findById(sectionId)
                .orElseThrow(() -> new NotFoundException("Section not found: " + sectionId));
        if (!section.getClubId().equals(clubId)) {
            throw new NotFoundException("Section not found: " + sectionId);
        }
        return section;
    }
}
