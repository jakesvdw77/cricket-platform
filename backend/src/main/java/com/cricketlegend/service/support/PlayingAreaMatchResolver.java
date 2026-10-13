package com.cricketlegend.service.support;

import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.exception.FieldRejectedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayingAreaNotMatchableException;
import com.cricketlegend.repository.PlayingAreaRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * docs/specs/099-fields-directory.md: resolves the {@code playingAreaId} a match request names to the field the match
 * will really use. A merged-away id resolves transparently to its merge target; a field that is not a cricket field is
 * refused with {@link PlayingAreaNotMatchableException}; a rejected one with {@link FieldRejectedException}. An unknown
 * id is a {@link NotFoundException}.
 */
@Component
public class PlayingAreaMatchResolver {

    private static final int MAX_MERGE_HOPS = 10;

    private final PlayingAreaRepository playingAreaRepository;

    public PlayingAreaMatchResolver(PlayingAreaRepository playingAreaRepository) {
        this.playingAreaRepository = playingAreaRepository;
    }

    public PlayingArea resolveForMatch(UUID playingAreaId) {
        PlayingArea area = follow(playingAreaId);
        if (area.getAreaType() != PlayingAreaType.CRICKET_FIELD) {
            throw new PlayingAreaNotMatchableException("Only a cricket field can be used for a match: " + playingAreaId);
        }
        if (area.getVerificationStatus() == PlayingAreaVerificationStatus.REJECTED) {
            throw new FieldRejectedException("This field has been rejected; choose another field: " + area.getId());
        }
        return area;
    }

    /** The row for {@code playingAreaId}, following {@code merged_into_id} to the surviving field. */
    public PlayingArea follow(UUID playingAreaId) {
        PlayingArea area = find(playingAreaId);
        for (int hops = 0; area.getMergedIntoId() != null && hops < MAX_MERGE_HOPS; hops++) {
            area = find(area.getMergedIntoId());
        }
        return area;
    }

    private PlayingArea find(UUID id) {
        return playingAreaRepository
                .findById(id)
                .orElseThrow(() -> new NotFoundException("Field not found: " + id));
    }
}
