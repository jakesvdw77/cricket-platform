package com.cricketlegend.service.impl;

import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.MyFieldDto;
import com.cricketlegend.mapper.MyFieldMapper;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.MyFieldService;
import com.cricketlegend.service.support.MyPlayerAccess;
import com.cricketlegend.service.support.PlayingAreaMatchResolver;
import com.cricketlegend.service.support.SeasonResolution;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/121 (Field Directory). Authorised only by {@link MyPlayerAccess#resolve}. The club comes from the resolved
 * player, never from the request. Home fields are the club's home links; away fields are the distinct fields of the
 * club's active matches in its current season (a free-text venue contributes nothing). A merged-away id follows to its
 * target through {@link PlayingAreaMatchResolver#follow}; rejected, merged-away and non-cricket-field rows are dropped.
 */
@Service
class MyFieldServiceImpl implements MyFieldService {

    /** Decision 21: a club that somehow has more fields than this is capped, home fields first. */
    static final int MAX_FIELDS = 200;

    private final MyPlayerAccess myPlayerAccess;
    private final ClubPlayingAreaRepository clubPlayingAreaRepository;
    private final SeasonRepository seasonRepository;
    private final MatchRepository matchRepository;
    private final PlayingAreaRepository playingAreaRepository;
    private final PlayingAreaMatchResolver matchResolver;
    private final MyFieldMapper mapper;

    MyFieldServiceImpl(
            MyPlayerAccess myPlayerAccess,
            ClubPlayingAreaRepository clubPlayingAreaRepository,
            SeasonRepository seasonRepository,
            MatchRepository matchRepository,
            PlayingAreaRepository playingAreaRepository,
            PlayingAreaMatchResolver matchResolver,
            MyFieldMapper mapper) {
        this.myPlayerAccess = myPlayerAccess;
        this.clubPlayingAreaRepository = clubPlayingAreaRepository;
        this.seasonRepository = seasonRepository;
        this.matchRepository = matchRepository;
        this.playingAreaRepository = playingAreaRepository;
        this.matchResolver = matchResolver;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyFieldDto> list(Authentication authentication, String playerKey) {
        UUID clubId = myPlayerAccess.resolve(authentication, playerKey).profile().getClubId();

        Set<UUID> homeIds = new LinkedHashSet<>();
        for (ClubPlayingArea link : clubPlayingAreaRepository.findByClubIdAndHomeTrue(clubId)) {
            homeIds.add(link.getPlayingAreaId());
        }
        UUID seasonId = SeasonResolution.currentSeasonId(seasonRepository.findByClubId(clubId));
        List<UUID> awayIds = seasonId == null ? List.of() : matchRepository.findPlayingAreaIdsInSeason(clubId, seasonId);

        // Warm the session with every named row in one query; the merge follow below then reads from it.
        Set<UUID> named = new LinkedHashSet<>(homeIds);
        named.addAll(awayIds);
        if (!named.isEmpty()) {
            playingAreaRepository.findAllById(named);
        }

        Map<UUID, PlayingArea> home = surviving(homeIds);
        Map<UUID, PlayingArea> away = surviving(new LinkedHashSet<>(awayIds));
        away.keySet().removeAll(home.keySet());

        Comparator<MyFieldDto> order = Comparator.comparing(MyFieldDto::home, Comparator.reverseOrder())
                .thenComparing(f -> f.name().toLowerCase())
                .thenComparing(MyFieldDto::id);
        return Stream.concat(
                        home.values().stream().map(a -> mapper.toDto(a, true)),
                        away.values().stream().map(a -> mapper.toDto(a, false)))
                .sorted(order)
                .limit(MAX_FIELDS)
                .toList();
    }

    /** The distinct, eligible merge targets of {@code ids}, keyed by their own id. */
    private Map<UUID, PlayingArea> surviving(Set<UUID> ids) {
        Map<UUID, PlayingArea> result = new LinkedHashMap<>();
        for (UUID id : ids) {
            PlayingArea area = matchResolver.follow(id);
            if (area.getMergedIntoId() == null
                    && area.getAreaType() == PlayingAreaType.CRICKET_FIELD
                    && area.getVerificationStatus() != PlayingAreaVerificationStatus.REJECTED) {
                result.putIfAbsent(area.getId(), area);
            }
        }
        return result;
    }
}
