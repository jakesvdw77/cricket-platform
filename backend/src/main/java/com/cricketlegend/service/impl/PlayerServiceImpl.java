package com.cricketlegend.service.impl;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.ClubMembership;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerListFocus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.PlayerVerificationStatus;
import com.cricketlegend.dto.CreatePlayerRequest;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.dto.PlayersSummaryDto;
import com.cricketlegend.dto.UpdatePlayerRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayerMapper;
import com.cricketlegend.repository.ClubMembershipRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.PlayerService;
import com.cricketlegend.service.support.PlayerRoster;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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

    static final LocalDate EARLIEST_DATE_OF_BIRTH = LocalDate.of(1900, 1, 1);

    private final ClubRepository clubRepository;
    private final PersonRepository personRepository;
    private final ClubMembershipRepository clubMembershipRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PlayerSectionRepository playerSectionRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;
    private final MatchSidePlayerRepository matchSidePlayerRepository;
    private final PlayerMapper playerMapper;
    private final AccessService accessService;

    public PlayerServiceImpl(
            ClubRepository clubRepository,
            PersonRepository personRepository,
            ClubMembershipRepository clubMembershipRepository,
            PlayerProfileRepository playerProfileRepository,
            PlayerSectionRepository playerSectionRepository,
            TeamSquadMemberRepository teamSquadMemberRepository,
            MatchSidePlayerRepository matchSidePlayerRepository,
            PlayerMapper playerMapper,
            AccessService accessService) {
        this.clubRepository = clubRepository;
        this.personRepository = personRepository;
        this.clubMembershipRepository = clubMembershipRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.playerSectionRepository = playerSectionRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
        this.matchSidePlayerRepository = matchSidePlayerRepository;
        this.playerMapper = playerMapper;
        this.accessService = accessService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlayerDto> list(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            boolean missingDateOfBirth,
            boolean includeInactive,
            PlayerListFocus focus,
            UUID seasonId) {
        if (focus != null && focus.needsSeason() && seasonId == null) {
            throw new ValidationException("seasonId is required for focus '" + focus.value() + "'");
        }
        PlayerRoster roster = visibleRoster(authentication, clubId, sectionId, missingDateOfBirth, includeInactive);
        List<PlayerProfile> visible = applyFocus(roster.profiles(), clubId, focus, seasonId);
        if (visible.isEmpty()) {
            return List.of();
        }

        Map<UUID, Person> personsById = new HashMap<>();
        personRepository
                .findAllById(visible.stream().map(PlayerProfile::getPersonId).toList())
                .forEach(person -> personsById.put(person.getId(), person));

        return visible.stream()
                .map(profile -> {
                    Person person = personsById.get(profile.getPersonId());
                    if (person == null) {
                        throw new NotFoundException("Person not found: " + profile.getPersonId());
                    }
                    return playerMapper.toDto(
                            person, profile, roster.sectionsByProfile().getOrDefault(profile.getId(), List.of()));
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PlayersSummaryDto summary(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            boolean missingDateOfBirth,
            boolean includeInactive,
            UUID seasonId) {
        List<PlayerProfile> players =
                visibleRoster(authentication, clubId, sectionId, missingDateOfBirth, includeInactive).profiles();
        long unverified = players.stream()
                .filter(profile -> profile.getVerificationStatus() == PlayerVerificationStatus.UNVERIFIED)
                .count();
        long inSquad = 0;
        long selected = 0;
        if (seasonId != null && !players.isEmpty()) {
            inSquad = countIn(players, squadPlayerIds(seasonId));
            selected = countIn(players, selectedPlayerIds(clubId, seasonId));
        }
        return new PlayersSummaryDto(players.size(), inSquad, selected, unverified);
    }

    /**
     * The one place that decides which players the Players page lists and counts (docs/specs/088): the caller's section
     * scope (an explicit {@code sectionId} narrows to its own closure), the Missing date of birth filter, and {@code
     * includeInactive}. With {@code includeInactive = false} suspended ({@code active = false}) and rejected players are
     * left out; unverified players are always included, so a request is never hidden from the manager. Shared by {@link
     * #list} and {@link #summary} so a counter and its list cannot disagree.
     */
    private PlayerRoster visibleRoster(
            Authentication authentication,
            UUID clubId,
            UUID sectionId,
            boolean missingDateOfBirth,
            boolean includeInactive) {
        Optional<Set<UUID>> accessibleSectionIds = accessService.accessibleSectionIds(authentication, clubId);
        Set<UUID> narrowTo = null;
        if (sectionId != null) {
            accessService.assertCanAdministerSection(authentication, clubId, sectionId);
            narrowTo = accessService.sectionAndDescendantIds(clubId, sectionId);
        }
        final Set<UUID> narrowToFinal = narrowTo;

        List<PlayerProfile> profiles = missingDateOfBirth
                ? playerProfileRepository.findByClubIdWithoutDateOfBirth(clubId)
                : playerProfileRepository.findByClubId(clubId);
        if (profiles.isEmpty()) {
            return PlayerRoster.empty();
        }

        // Batch the section lookup once, never per player.
        Map<UUID, List<UUID>> sectionsByProfile = new HashMap<>();
        playerSectionRepository
                .findByPlayerProfileIdIn(profiles.stream().map(PlayerProfile::getId).toList())
                .forEach(link -> sectionsByProfile
                        .computeIfAbsent(link.getPlayerProfileId(), id -> new ArrayList<>())
                        .add(link.getSectionId()));

        List<PlayerProfile> visible = profiles.stream()
                .filter(profile -> includeInactive
                        || (profile.isActive()
                                && profile.getVerificationStatus() != PlayerVerificationStatus.REJECTED))
                .filter(profile -> {
                    List<UUID> tagged = sectionsByProfile.getOrDefault(profile.getId(), List.of());
                    if (accessibleSectionIds.isPresent()
                            && tagged.stream().noneMatch(accessibleSectionIds.get()::contains)) {
                        return false;
                    }
                    return narrowToFinal == null || tagged.stream().anyMatch(narrowToFinal::contains);
                })
                .toList();
        return new PlayerRoster(visible, sectionsByProfile);
    }

    private List<PlayerProfile> applyFocus(
            List<PlayerProfile> players, UUID clubId, PlayerListFocus focus, UUID seasonId) {
        if (focus == null || players.isEmpty()) {
            return players;
        }
        if (focus == PlayerListFocus.UNVERIFIED) {
            return players.stream()
                    .filter(profile -> profile.getVerificationStatus() == PlayerVerificationStatus.UNVERIFIED)
                    .toList();
        }
        // a plain conditional, not a switch: a switch over an enum compiles to a synthetic nested class, which the
        // architecture rule for service.impl does not allow
        return focus == PlayerListFocus.IN_SQUAD
                ? keepIn(players, squadPlayerIds(seasonId))
                : keepIn(players, selectedPlayerIds(clubId, seasonId));
    }

    private Set<UUID> squadPlayerIds(UUID seasonId) {
        return new HashSet<>(teamSquadMemberRepository.findDistinctPlayerProfileIdsBySeasonId(seasonId));
    }

    private Set<UUID> selectedPlayerIds(UUID clubId, UUID seasonId) {
        return new HashSet<>(matchSidePlayerRepository.findDistinctSelectedPlayerProfileIds(clubId, seasonId));
    }

    private static List<PlayerProfile> keepIn(List<PlayerProfile> players, Set<UUID> ids) {
        return players.stream().filter(profile -> ids.contains(profile.getId())).toList();
    }

    private static long countIn(List<PlayerProfile> players, Set<UUID> ids) {
        return players.stream().filter(profile -> ids.contains(profile.getId())).count();
    }

    @Override
    @Transactional
    public PlayerDto verify(Authentication authentication, UUID clubId, UUID playerId) {
        return changeVerificationStatus(authentication, clubId, playerId, PlayerVerificationStatus.VERIFIED);
    }

    @Override
    @Transactional
    public PlayerDto reject(Authentication authentication, UUID clubId, UUID playerId) {
        return changeVerificationStatus(authentication, clubId, playerId, PlayerVerificationStatus.REJECTED);
    }

    /**
     * docs/specs/088: the allowed changes are {@code UNVERIFIED -> VERIFIED}, {@code UNVERIFIED -> REJECTED} and {@code
     * REJECTED -> VERIFIED} (undo a mistaken reject); anything else is a 409. A verified player is never rejected (a
     * manager suspends them instead).
     */
    private PlayerDto changeVerificationStatus(
            Authentication authentication, UUID clubId, UUID playerId, PlayerVerificationStatus target) {
        PlayerProfile profile = findOrThrowForClub(clubId, playerId);
        accessService.assertCanAdministerAnySection(authentication, clubId, sectionIds(profile.getId()));
        PlayerVerificationStatus current = profile.getVerificationStatus();
        boolean allowed = target == PlayerVerificationStatus.VERIFIED
                ? current != PlayerVerificationStatus.VERIFIED
                : current == PlayerVerificationStatus.UNVERIFIED;
        if (!allowed) {
            throw new InvalidStatusTransitionException(
                    target == PlayerVerificationStatus.VERIFIED
                            ? "Player is already verified: " + playerId
                            : "Only an unverified player can be rejected: " + playerId);
        }
        profile.setVerificationStatus(target);
        profile = playerProfileRepository.save(profile);

        Person person = findPersonOrThrow(profile.getPersonId());
        return playerMapper.toDto(person, profile, sectionIds(profile.getId()));
    }

    @Override
    @Transactional
    public PlayerDto create(UUID clubId, CreatePlayerRequest request) {
        requireClubExists(clubId);
        requireNonNegativeJerseyNumber(request.jerseyNumber());
        requireValidDateOfBirth(request.dateOfBirth());

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
        requireValidDateOfBirth(request.dateOfBirth());
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
     * docs/specs/077-public-availability-form-verification.md: a player's date of birth is required
     * on create and update (the column stays nullable for existing rows), not in the future and not
     * before {@link #EARLIEST_DATE_OF_BIRTH}. Applied to the submitted payload on both paths.
     */
    private void requireValidDateOfBirth(LocalDate dateOfBirth) {
        if (dateOfBirth == null) {
            throw new ValidationException("Date of birth is required");
        }
        if (dateOfBirth.isAfter(LocalDate.now())) {
            throw new ValidationException("Date of birth must not be in the future");
        }
        if (dateOfBirth.isBefore(EARLIEST_DATE_OF_BIRTH)) {
            throw new ValidationException("Date of birth must not be before 1900-01-01");
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
