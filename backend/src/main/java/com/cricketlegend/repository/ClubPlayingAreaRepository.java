package com.cricketlegend.repository;

import com.cricketlegend.domain.ClubPlayingArea;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** docs/specs/099-fields-directory.md: a club's home links to playing areas. */
public interface ClubPlayingAreaRepository extends JpaRepository<ClubPlayingArea, UUID> {

    Optional<ClubPlayingArea> findByClubIdAndPlayingAreaId(UUID clubId, UUID playingAreaId);

    List<ClubPlayingArea> findByClubIdAndPlayingAreaIdIn(UUID clubId, Collection<UUID> playingAreaIds);

    /** docs/specs/121: a club's home links (the Field Directory's home fields). */
    List<ClubPlayingArea> findByClubIdAndHomeTrue(UUID clubId);

    List<ClubPlayingArea> findByPlayingAreaId(UUID playingAreaId);

    List<ClubPlayingArea> findByPlayingAreaIdIn(Collection<UUID> playingAreaIds);
}
