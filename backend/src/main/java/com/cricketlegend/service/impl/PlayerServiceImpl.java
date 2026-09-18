package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.ClubMembership;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.dto.UpdatePlayerRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayerMapper;
import com.cricketlegend.repository.ClubMembershipRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.service.PlayerService;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules per docs/specs/028-players.md: {@code create} builds+saves a new {@code Person}
 * ({@code status = ACTIVE} set directly, never via {@code PersonServiceImpl.findOrCreatePerson} —
 * a deliberate divergence, see the spec's Data Model Changes), a new {@code ClubMembership}
 * ({@code validFrom = today}, {@code validTo = null}), and a new {@code PlayerProfile}, all in one
 * transaction; {@code update} writes {@code firstName}/{@code lastName}/{@code dateOfBirth}/
 * {@code gender} straight onto the already-linked {@code Person} (no "link, don't overwrite"
 * guard — unambiguous, already-linked edit, unlike {@code findOrCreatePerson}'s own best-guess
 * match) alongside the {@code PlayerProfile}'s own fields; {@code deactivate}/{@code reactivate}
 * mirror {@code ClubContactServiceImpl}'s "DB constraint + service pre-check for a clean message"
 * pattern for {@code ux_club_membership_active} — {@code deactivate} closes the linked {@code
 * ClubMembership} ({@code validTo = today}), {@code reactivate} reopens it ({@code validTo =
 * null}), blocked with a distinct {@link InvalidStatusTransitionException} message if the person
 * already holds a different active membership by then; every lookup is scoped to {@code clubId}
 * ({@link #findOrThrowForClub}), not just by id, for real cross-club isolation at the data layer
 * (not only {@code @PreAuthorize}).
 */
@Service
public class PlayerServiceImpl implements PlayerService {

    private final ClubRepository clubRepository;
    private final PersonRepository personRepository;
    private final ClubMembershipRepository clubMembershipRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final PlayerMapper playerMapper;
    private final AccessService accessService;

    public PlayerServiceImpl(
            ClubRepository clubRepository,
            PersonRepository personRepository,
            ClubMembershipRepository clubMembershipRepository,
            PlayerProfileRepository playerProfileRepository,
            PlayerSectionRepository playerSectionRepository,
            PlayerMapper playerMapper,
            AccessService accessService) {
        this.clubRepository = clubRepository;
        this.personRepository = personRepository;
        this.clubMembershipRepository = clubMembershipRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.playerMapper = playerMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlayerDto> list(Authentication authentication, UUID clubId, UUID sectionId) {
        Optional<Set<UUID>> accessibleSectionIds = accessService.accessibleSectionIds(authentication, clubId);
        Set<UUID> narrowTo = null;
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            narrowTo = accessService.sectionAndDescendantIds(clubId, sectionId);
        }
        final Set<UUID> narrowToFinal = narrowTo;

        return playerProfileRepository.findByClubId(clubId).stream()
                .filter(profile -> {
                    List<UUID> tagged = sectionIds(profile.getId());
                    if (accessibleSectionIds.isPresent()
                            && tagged.stream().noneMatch(accessibleSectionIds.get()::contains)) {
                        return false;
                    }
                    return narrowToFinal == null || tagged.stream().anyMatch(narrowToFinal::contains);
                })
                .map(profile -> playerMapper.toDto(
                        findPersonOrThrow(profile.getPersonId()), profile, sectionIds(profile.getId())))
                .toList();
    }

    @Override
    @Transactional
    public PlayerDto create(UUID clubId, CreatePlayerRequest request) {
        requireClubExists(clubId);
        requireNonNegativeJerseyNumber(request.jerseyNumber());

        Person person = Person.builder()
                .firstName(request.firstName())
                .lastName(request.lastName())
                .dateOfBirth(request.dateOfBirth())
                .gender(request.gender())
                .email(null)
                .status(PersonStatus.ACTIVE)
                .build();
        person = personRepository.save(person);

        ClubMembership membership = ClubMembership.builder()
                .personId(person.getId())
                .clubId(clubId)
                .validFrom(LocalDate.now())
                .build();
        clubMembershipRepository.save(membership);

        PlayerProfile profile = PlayerProfile.builder()
                .personId(person.getId())
                .clubId(clubId)
                .photoUrl(request.photoUrl())
                .clubMembershipNumber(request.clubMembershipNumber())
                .medicalAidProvider(request.medicalAidProvider())
                .medicalAidMemberNumber(request.medicalAidMemberNumber())
                .phone(request.phone())
                .email(request.email())
                .altContactName(request.altContactName())
                .altContactPhone(request.altContactPhone())
                .battingStance(request.battingStance())
                .bowlingArm(request.bowlingArm())
                .bowlingType(request.bowlingType())
                .wicketKeeper(request.isWicketKeeper())
                .jerseyNumber(request.jerseyNumber())
                .active(true)
                .build();
        profile = playerProfileRepository.save(profile);

        return playerMapper.toDto(person, profile, List.of());
    }

    @Override
    @Transactional
    public PlayerDto update(Authentication authentication, UUID clubId, UUID playerId, UpdatePlayerRequest request) {
        PlayerProfile profile = findOrThrowForClub(clubId, playerId);
        accessService.assertCanAdministerAnySection(authentication, clubId, sectionIds(profile.getId()));
        requireNonNegativeJerseyNumber(request.jerseyNumber());
        Person person = findPersonOrThrow(profile.getPersonId());

        person.setFirstName(request.firstName());
        person.setLastName(request.lastName());
        person.setDateOfBirth(request.dateOfBirth());
        person.setGender(request.gender());
        personRepository.save(person);

        profile.setPhotoUrl(request.photoUrl());
        profile.setClubMembershipNumber(request.clubMembershipNumber());
        profile.setMedicalAidProvider(request.medicalAidProvider());
        profile.setMedicalAidMemberNumber(request.medicalAidMemberNumber());
        profile.setPhone(request.phone());
        profile.setEmail(request.email());
        profile.setAltContactName(request.altContactName());
        profile.setAltContactPhone(request.altContactPhone());
        profile.setBattingStance(request.battingStance());
        profile.setBowlingArm(request.bowlingArm());
        profile.setBowlingType(request.bowlingType());
        profile.setWicketKeeper(request.isWicketKeeper());
        profile.setJerseyNumber(request.jerseyNumber());
        profile = playerProfileRepository.save(profile);

        return playerMapper.toDto(person, profile, sectionIds(profile.getId()));
    }

    @Override
    @Transactional
    public PlayerDto deactivate(Authentication authentication, UUID clubId, UUID playerId) {
        PlayerProfile profile = findOrThrowForClub(clubId, playerId);
        accessService.assertCanAdministerAnySection(authentication, clubId, sectionIds(profile.getId()));
        if (!profile.isActive()) {
            throw new InvalidStatusTransitionException("Player is already inactive: " + playerId);
        }

        UUID personId = profile.getPersonId();
        ClubMembership membership = clubMembershipRepository
                .findByPersonIdAndValidToIsNull(personId)
                .orElseThrow(
                        () -> new NotFoundException("Active club membership not found for person: " + personId));
        membership.setValidTo(LocalDate.now());
        clubMembershipRepository.save(membership);

        profile.setActive(false);
        profile = playerProfileRepository.save(profile);

        Person person = findPersonOrThrow(profile.getPersonId());
        return playerMapper.toDto(person, profile, sectionIds(profile.getId()));
    }

    @Override
    @Transactional
    public PlayerDto reactivate(Authentication authentication, UUID clubId, UUID playerId) {
        PlayerProfile profile = findOrThrowForClub(clubId, playerId);
        accessService.assertCanAdministerAnySection(authentication, clubId, sectionIds(profile.getId()));
        if (profile.isActive()) {
            throw new InvalidStatusTransitionException("Player is already active: " + playerId);
        }

        UUID personId = profile.getPersonId();
        ClubMembership membership = clubMembershipRepository
                .findByPersonIdAndClubId(personId, clubId)
                .orElseThrow(() -> new NotFoundException("Club membership not found for person: " + personId));

        Optional<ClubMembership> currentlyActive = clubMembershipRepository.findByPersonIdAndValidToIsNull(personId);
        if (currentlyActive.isPresent() && !currentlyActive.get().getId().equals(membership.getId())) {
            throw new InvalidStatusTransitionException(
                    "Person " + personId + " already holds a different active club membership");
        }

        membership.setValidTo(null);
        clubMembershipRepository.save(membership);

        profile.setActive(true);
        profile = playerProfileRepository.save(profile);

        Person person = findPersonOrThrow(profile.getPersonId());
        return playerMapper.toDto(person, profile, sectionIds(profile.getId()));
    }

    private void requireClubExists(UUID clubId) {
        if (!clubRepository.existsById(clubId)) {
            throw new NotFoundException("Club not found: " + clubId);
        }
    }

    /**
     * The only jersey-number validation this codebase applies to {@code PlayerProfile.jerseyNumber}
     * — no uniqueness check (per docs/specs/031-jersey-numbers.md's Non-goals, two players may
     * share a standing number).
     */
    private void requireNonNegativeJerseyNumber(Integer jerseyNumber) {
        if (jerseyNumber != null && jerseyNumber < 0) {
            throw new ValidationException("Jersey number must not be negative: " + jerseyNumber);
        }
    }

    /**
     * 404s when {@code playerId} doesn't exist at all, or exists but belongs to a different
     * club — real cross-club isolation at the data layer, not only relying on the controller's
     * {@code @PreAuthorize}. Mirrors {@code SponsorServiceImpl.findOrThrowForClub}.
     */
    private PlayerProfile findOrThrowForClub(UUID clubId, UUID playerId) {
        PlayerProfile profile = playerProfileRepository
                .findById(playerId)
                .orElseThrow(() -> new NotFoundException("Player not found: " + playerId));
        if (!profile.getClubId().equals(clubId)) {
            throw new NotFoundException("Player not found: " + playerId);
        }
        return profile;
    }

    private Person findPersonOrThrow(UUID personId) {
        return personRepository
                .findById(personId)
                .orElseThrow(() -> new NotFoundException("Person not found: " + personId));
    }

    private List<UUID> sectionIds(UUID playerProfileId) {
        return playerSectionRepository.findByPlayerProfileId(playerProfileId).stream()
                .map(PlayerSection::getSectionId)
                .toList();
    }
}
