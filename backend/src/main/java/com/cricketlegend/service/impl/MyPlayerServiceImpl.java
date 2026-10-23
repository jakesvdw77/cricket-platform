package com.cricketlegend.service.impl;

import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.MyPlayerAgentDto;
import com.cricketlegend.dto.MyPlayerDto;
import com.cricketlegend.dto.MyPlayerSummaryDto;
import com.cricketlegend.dto.UpdateMyPlayerRequest;
import com.cricketlegend.mapper.MyPlayerMapper;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonLinkRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.service.MyPlayerService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.PlayerGroupLabels;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/119 "My players". Every method is authorised by {@link MyPlayerAccess} from the caller's own rows; the
 * responses carry no date of birth and nothing about any other player. An edit sets {@code PlayerProfile.updatedBy} to
 * the caller's person so the manager can see who changed what. Names and contact details are never logged.
 */
@Service
public class MyPlayerServiceImpl implements MyPlayerService {

    private static final Logger log = LoggerFactory.getLogger(MyPlayerServiceImpl.class);

    private final MyPlayerAccess access;
    private final ClubRepository clubRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonLinkRepository personLinkRepository;
    private final PersonRepository personRepository;
    private final PlayerGroupLabels groupLabels;
    private final MyPlayerMapper mapper;

    public MyPlayerServiceImpl(
            MyPlayerAccess access,
            ClubRepository clubRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonLinkRepository personLinkRepository,
            PersonRepository personRepository,
            PlayerGroupLabels groupLabels,
            MyPlayerMapper mapper) {
        this.access = access;
        this.clubRepository = clubRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personLinkRepository = personLinkRepository;
        this.personRepository = personRepository;
        this.groupLabels = groupLabels;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyPlayerSummaryDto> list(Authentication authentication) {
        List<HeldPlayer> held = access.list(authentication);
        if (held.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> clubNames = clubNames(held);
        Map<UUID, String> labels = groupLabels.groupLabels(held.stream().map(HeldPlayer::profile).toList());
        return held.stream()
                .map(h -> mapper.toSummary(h, clubNames.get(h.profile().getClubId()), labels.get(h.profile().getId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public MyPlayerDto get(Authentication authentication, String key) {
        return toDto(access.resolve(authentication, key));
    }

    @Override
    @Transactional
    public MyPlayerDto update(Authentication authentication, String key, UpdateMyPlayerRequest request) {
        HeldPlayer held = access.resolve(authentication, key);
        PlayerProfile profile = held.profile();
        List<String> changed = new ArrayList<>();

        boolean medicalSent = request.medicalAidProvider() != null || request.medicalAidMemberNumber() != null;
        if (held.canEditMedical()) {
            set(changed, "medicalAidProvider", profile.getMedicalAidProvider(), blankToNull(request.medicalAidProvider()),
                    profile::setMedicalAidProvider);
            set(changed, "medicalAidMemberNumber", profile.getMedicalAidMemberNumber(),
                    blankToNull(request.medicalAidMemberNumber()), profile::setMedicalAidMemberNumber);
        } else if (medicalSent
                && (differs(profile.getMedicalAidProvider(), request.medicalAidProvider())
                        || differs(profile.getMedicalAidMemberNumber(), request.medicalAidMemberNumber()))) {
            log.warn("My player medical edit refused: account={} club={}", held.caller().getId(), profile.getClubId());
            throw new AccessDeniedException("Only the main agent or the adult player can change medical aid details.");
        }

        set(changed, "photoUrl", profile.getPhotoUrl(), blankToNull(request.photoUrl()), profile::setPhotoUrl);
        set(changed, "phone", profile.getPhone(), blankToNull(request.phone()), profile::setPhone);
        // the contact email also drives the email match, so only the main agent or the player may change it
        if (held.self() || held.main()) {
            set(changed, "email", profile.getEmail(), blankToNull(request.email()), profile::setEmail);
        } else if (differs(profile.getEmail(), request.email())) {
            log.warn("My player email edit refused: account={} club={}", held.caller().getId(), profile.getClubId());
            throw new AccessDeniedException("Only the main agent or the player can change the contact email.");
        }
        set(changed, "altContactName", profile.getAltContactName(), blankToNull(request.altContactName()),
                profile::setAltContactName);
        set(changed, "altContactPhone", profile.getAltContactPhone(), blankToNull(request.altContactPhone()),
                profile::setAltContactPhone);
        set(changed, "battingStance", profile.getBattingStance(), request.battingStance(), profile::setBattingStance);
        set(changed, "bowlingArm", profile.getBowlingArm(), request.bowlingArm(), profile::setBowlingArm);
        set(changed, "bowlingType", profile.getBowlingType(), request.bowlingType(), profile::setBowlingType);
        set(changed, "isWicketKeeper", profile.isWicketKeeper(), request.isWicketKeeper(), profile::setWicketKeeper);

        profile.setUpdatedBy(held.caller().getId());
        playerProfileRepository.save(profile);
        log.info("My player updated: account={} player={} club={} self={} fields={}",
                held.caller().getId(), profile.getId(), profile.getClubId(), held.self(), changed);
        return toDto(held);
    }

    private MyPlayerDto toDto(HeldPlayer held) {
        PlayerProfile profile = held.profile();
        Set<UUID> ids = Set.of(profile.getId());
        List<String> sections = groupLabels.sectionNames(ids).getOrDefault(profile.getId(), List.of());
        List<String> teams = groupLabels.teamNames(ids).getOrDefault(profile.getId(), List.of());
        String label = !sections.isEmpty() ? sections.get(0) : teams.isEmpty() ? null : teams.get(0);
        String clubName = clubRepository.findById(profile.getClubId()).map(Club::getName).orElse(null);

        List<PersonLink> links = personLinkRepository.findActiveBySubjectAndClub(held.subject().getId(), profile.getClubId());
        List<MyPlayerAgentDto> agents = List.of();
        if (held.main()) {
            // the main agent sees the other agents by name and masked email, never anything more
            Map<UUID, Person> accounts = personRepository
                    .findAllById(links.stream()
                            .map(PersonLink::getAccountPersonId)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toSet()))
                    .stream()
                    .collect(Collectors.toMap(Person::getId, p -> p));
            agents = links.stream()
                    .filter(l -> !l.getId().equals(held.link().getId()) && accounts.containsKey(l.getAccountPersonId()))
                    .sorted(Comparator.comparing(PersonLink::getCreatedAt).thenComparing(PersonLink::getId))
                    .map(l -> mapper.toAgent(accounts.get(l.getAccountPersonId()), l.isMain()))
                    .toList();
        }
        return mapper.toDto(held, clubName, label, sections, teams, links.size(), agents);
    }

    private Map<UUID, String> clubNames(List<HeldPlayer> held) {
        return clubRepository
                .findAllById(held.stream().map(h -> h.profile().getClubId()).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Club::getId, Club::getName));
    }

    private static <T> void set(List<String> changed, String field, T current, T next, java.util.function.Consumer<T> setter) {
        if (!Objects.equals(current, next)) {
            setter.accept(next);
            changed.add(field);
        }
    }

    private static boolean differs(String stored, String sent) {
        return sent != null && !Objects.equals(blankToNull(stored), blankToNull(sent));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
