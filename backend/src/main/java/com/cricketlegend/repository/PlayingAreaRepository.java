package com.cricketlegend.repository;

import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * docs/specs/099-fields-directory.md: the directory of playing areas. Search, counters and moderation queue are all
 * composed from {@link PlayingAreaSpecifications} so a counter always equals its list.
 */
public interface PlayingAreaRepository extends JpaRepository<PlayingArea, UUID>, JpaSpecificationExecutor<PlayingArea> {

    /**
     * The not-merged-away area with exactly this identity (type, name and city ignoring case, country code): the row
     * behind {@code ux_playing_area_identity}. Used to offer the existing field in the 409 body.
     */
    @Query("select a from PlayingArea a where a.areaType = :areaType and lower(a.name) = lower(:name) "
            + "and lower(a.address.city) = lower(:city) and a.address.country = :country and a.mergedIntoId is null")
    List<PlayingArea> findByIdentity(
            @Param("areaType") PlayingAreaType areaType,
            @Param("name") String name,
            @Param("city") String city,
            @Param("country") String country);

    long countByVerificationStatusAndMergedIntoIdIsNull(PlayingAreaVerificationStatus status);
}
