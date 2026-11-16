package com.cricketlegend.service;

import com.cricketlegend.dto.GalleryFiltersDto;
import com.cricketlegend.dto.GalleryImageDto;
import com.cricketlegend.dto.GalleryPageDto;
import com.cricketlegend.dto.GalleryQuery;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/157-photo-gallery.md. The Hub methods are authorised only from the caller's own held player (the club comes
 * from that player); the manager methods take the club the controller already authorised.
 */
public interface GalleryService {

    GalleryPageDto list(Authentication authentication, String playerKey, GalleryQuery query, Integer page, Integer size);

    List<GalleryImageDto> latest(Authentication authentication, String playerKey, Integer limit);

    GalleryFiltersDto filters(Authentication authentication, String playerKey);

    /** {@code tagMyPlayer} tags the held player of {@code playerKey}; the Hub tags no other player. */
    GalleryImageDto upload(
            Authentication authentication,
            String playerKey,
            MultipartFile medium,
            MultipartFile thumb,
            String caption,
            UUID leagueId,
            UUID teamId,
            boolean tagMyPlayer);

    /** Deletes the caller's own photo; another person's is a 404. */
    void delete(Authentication authentication, String playerKey, UUID imageId);

    GalleryPageDto listForClub(UUID clubId, UUID callerPersonId, GalleryQuery query, Integer page, Integer size);

    GalleryImageDto uploadForClub(
            UUID clubId,
            UUID callerPersonId,
            MultipartFile medium,
            MultipartFile thumb,
            String caption,
            UUID leagueId,
            UUID teamId,
            List<UUID> playerIds);

    GalleryFiltersDto filtersForClub(UUID clubId);

    /** Deletes any photo of the club. */
    void deleteForClub(UUID clubId, UUID imageId);
}
