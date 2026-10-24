package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.MyFieldDto;
import com.cricketlegend.mapper.MyFieldMapper;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.PlayingAreaMatchResolver;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.TestingAuthenticationToken;

/**
 * docs/specs/121 (Field Directory) rules: home and away merge, de-duplication, exclusions, merge targets, ordering, the
 * cap and a club with no season. Real resolver and mapper over mocked repositories.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MyFieldServiceImplTest {

    @Mock private MyPlayerAccess access;
    @Mock private ClubPlayingAreaRepository clubPlayingAreaRepository;
    @Mock private SeasonRepository seasonRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private PlayingAreaRepository playingAreaRepository;

    private MyFieldServiceImpl service;
    private final TestingAuthenticationToken auth = new TestingAuthenticationToken("sub", null, List.of());
    private final UUID clubId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final Map<UUID, PlayingArea> areas = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new MyFieldServiceImpl(access, clubPlayingAreaRepository, seasonRepository, matchRepository,
                playingAreaRepository, new PlayingAreaMatchResolver(playingAreaRepository),
                Mappers.getMapper(MyFieldMapper.class));
        PlayerProfile profile = PlayerProfile.builder().id(UUID.randomUUID()).personId(UUID.randomUUID()).clubId(clubId)
                .active(true).build();
        when(access.resolve(auth, "key")).thenReturn(new HeldPlayer("key", null, null, profile, null));
        when(playingAreaRepository.findById(any())).thenAnswer(i -> Optional.ofNullable(areas.get(i.getArgument(0))));
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of(Season.builder().id(seasonId).clubId(clubId)
                .label("now").startDate(LocalDate.now().minusDays(10)).endDate(LocalDate.now().plusDays(10))
                .createdAt(Instant.now()).build()));
        when(clubPlayingAreaRepository.findByClubIdAndHomeTrue(clubId)).thenReturn(List.of());
        when(matchRepository.findPlayingAreaIdsInSeason(clubId, seasonId)).thenReturn(List.of());
    }

    private PlayingArea area(String name, PlayingAreaVerificationStatus status) {
        PlayingArea a = PlayingArea.builder().id(UUID.randomUUID()).areaType(PlayingAreaType.CRICKET_FIELD).name(name)
                .category(PlayingAreaCategory.CLUB).ownerType(PlayingAreaOwnerType.CLUB).ownerName("Owner")
                .address(Address.builder().number("12").street("Main Rd").city("Cape Town").provinceState("WC")
                        .postalCode("8001").country("ZA").build())
                .mapUrl("https://maps.example.com/x").verificationStatus(status).build();
        areas.put(a.getId(), a);
        return a;
    }

    private PlayingArea area(String name) {
        return area(name, PlayingAreaVerificationStatus.VERIFIED);
    }

    private void home(PlayingArea... homes) {
        when(clubPlayingAreaRepository.findByClubIdAndHomeTrue(clubId)).thenReturn(java.util.Arrays.stream(homes)
                .map(h -> ClubPlayingArea.builder().clubId(clubId).playingAreaId(h.getId()).home(true).build()).toList());
    }

    private void away(PlayingArea... aways) {
        when(matchRepository.findPlayingAreaIdsInSeason(clubId, seasonId))
                .thenReturn(java.util.Arrays.stream(aways).map(PlayingArea::getId).toList());
    }

    private List<MyFieldDto> list() {
        return service.list(auth, "key");
    }

    @Test
    void homeThenAwayEachByCaseInsensitiveName() {
        PlayingArea zulu = area("zulu Oval");
        PlayingArea alpha = area("Alpha Park");
        PlayingArea bravo = area("bravo Ground");
        PlayingArea charlie = area("Charlie Field");
        home(zulu, alpha);
        away(charlie, bravo);

        List<MyFieldDto> result = list();

        assertThat(result).extracting(MyFieldDto::name).containsExactly("Alpha Park", "zulu Oval", "bravo Ground", "Charlie Field");
        assertThat(result).extracting(MyFieldDto::home).containsExactly(true, true, false, false);
    }

    @Test
    void aFieldThatIsHomeAndPlayedAtAppearsOnceAsHome() {
        PlayingArea both = area("Both Oval");
        PlayingArea other = area("Other Oval");
        home(both);
        away(both, other);

        List<MyFieldDto> result = list();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).id()).isEqualTo(both.getId());
        assertThat(result.get(0).home()).isTrue();
        assertThat(result.get(1).home()).isFalse();
    }

    @Test
    void aDuplicateAwayIdAppearsOnce() {
        PlayingArea a = area("Away Oval");
        away(a, a);
        assertThat(list()).hasSize(1);
    }

    @Test
    void rejectedAndNonCricketAndMergedAwayRowsAreExcludedButUnverifiedIsKept() {
        PlayingArea rejected = area("Rejected", PlayingAreaVerificationStatus.REJECTED);
        PlayingArea unverified = area("Unverified", PlayingAreaVerificationStatus.UNVERIFIED);
        PlayingArea notField = area("Net Lane");
        notField.setAreaType(null);
        PlayingArea verified = area("Verified");
        home(rejected);
        away(unverified, notField, verified);

        List<MyFieldDto> result = list();

        assertThat(result).extracting(MyFieldDto::name).containsExactly("Unverified", "Verified");
        assertThat(result).extracting(MyFieldDto::verified).containsExactly(false, true);
    }

    @Test
    void aMergedAwayIdResolvesToItsTargetOnceEvenWhenTheTargetIsAlsoNamed() {
        PlayingArea target = area("Target Oval");
        PlayingArea source = area("Old Oval");
        source.setMergedIntoId(target.getId());
        away(source, target);

        List<MyFieldDto> result = list();

        assertThat(result).extracting(MyFieldDto::id).containsExactly(target.getId());
    }

    @Test
    void aMergedHomeIdResolvesToTheTargetAndAMergeIntoARejectedTargetIsDropped() {
        PlayingArea target = area("Target Oval");
        PlayingArea source = area("Old Oval");
        source.setMergedIntoId(target.getId());
        PlayingArea rejectedTarget = area("Bad", PlayingAreaVerificationStatus.REJECTED);
        PlayingArea toRejected = area("Gone");
        toRejected.setMergedIntoId(rejectedTarget.getId());
        home(source);
        away(toRejected);

        List<MyFieldDto> result = list();

        assertThat(result).extracting(MyFieldDto::id).containsExactly(target.getId());
        assertThat(result.get(0).home()).isTrue();
    }

    @Test
    void aClubWithNoSeasonHasOnlyHomeFieldsAndNeverQueriesMatches() {
        PlayingArea h = area("Home Oval");
        home(h);
        when(seasonRepository.findByClubId(clubId)).thenReturn(List.of());

        List<MyFieldDto> result = list();

        assertThat(result).extracting(MyFieldDto::id).containsExactly(h.getId());
        verify(matchRepository, never()).findPlayingAreaIdsInSeason(any(), any());
    }

    @Test
    void theListIsCappedAtTwoHundredKeepingHomeFieldsFirst() {
        PlayingArea h = area("zzz Home");
        home(h);
        PlayingArea[] aways = new PlayingArea[205];
        for (int i = 0; i < aways.length; i++) {
            aways[i] = area(String.format("Away %03d", i));
        }
        away(aways);

        List<MyFieldDto> result = list();

        assertThat(result).hasSize(200);
        assertThat(result.get(0).id()).isEqualTo(h.getId());
        assertThat(result.get(199).name()).isEqualTo("Away 198");
    }

    @Test
    void aBlankOwnerIsNullAndTheAddressIsFlattened() {
        PlayingArea a = area("Away Oval");
        a.setOwnerName("   ");
        away(a);

        MyFieldDto dto = list().get(0);

        assertThat(dto.owner()).isNull();
        assertThat(dto.addressLine1()).isEqualTo("12 Main Rd");
        assertThat(dto.city()).isEqualTo("Cape Town");
        assertThat(dto.provinceState()).isEqualTo("WC");
        assertThat(dto.postalCode()).isEqualTo("8001");
        assertThat(dto.country()).isEqualTo("ZA");
        assertThat(dto.mapUrl()).isEqualTo("https://maps.example.com/x");
    }

    @Test
    void anAddressWithOnlyAStreetOrNothingGivesTheStreetOrNull() {
        PlayingArea streetOnly = area("A Street");
        streetOnly.getAddress().setNumber(null);
        PlayingArea none = area("B None");
        none.getAddress().setStreet(" ");
        none.getAddress().setNumber(null);
        away(streetOnly, none);

        List<MyFieldDto> result = list();

        assertThat(result.get(0).addressLine1()).isEqualTo("Main Rd");
        assertThat(result.get(1).addressLine1()).isNull();
    }
}
