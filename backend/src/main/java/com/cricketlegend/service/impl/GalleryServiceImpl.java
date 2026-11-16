package com.cricketlegend.service.impl;

import com.cricketlegend.domain.GalleryImage;
import com.cricketlegend.domain.GalleryImageTag;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.GalleryFiltersDto;
import com.cricketlegend.dto.GalleryImageDto;
import com.cricketlegend.dto.GalleryPageDto;
import com.cricketlegend.dto.GalleryQuery;
import com.cricketlegend.dto.GalleryTagDto;
import com.cricketlegend.exception.LinkRateLimitedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.UnsupportedMediaTypeException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.GalleryImageRepository;
import com.cricketlegend.repository.GalleryImageTagRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.GalleryService;
import com.cricketlegend.service.MediaService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/157-photo-gallery.md. The browser sends one photo at a time as a medium and a thumbnail JPEG; this service
 * checks both decode as images and stay inside the size caps, stores them through {@link MediaService}, and tags the
 * photo to a league, a team and up to five players of the club. Every list is a page; the latest list is capped. The Hub
 * is authorised only by {@link MyPlayerAccess#resolve} (the club comes from the resolved player, never from the request).
 */
@Service
class GalleryServiceImpl implements GalleryService {

    static final int DEFAULT_SIZE = 24;
    static final int MAX_SIZE = 48;
    static final int MAX_LATEST = 12;
    static final int MAX_QUERY_LENGTH = 60;
    static final int MAX_CAPTION_LENGTH = 200;
    static final int MAX_PLAYER_TAGS = 5;
    static final int DAILY_LIMIT = 60;
    static final long MAX_MEDIUM_BYTES = 2L * 1024 * 1024;
    static final long MAX_THUMB_BYTES = 200L * 1024;
    private static final Map<String, String> JPEG_ONLY = Map.of("image/jpeg", ".jpg");
    private static final UUID NO_ID = new UUID(0L, 0L);
    private static final Logger log = LoggerFactory.getLogger(GalleryServiceImpl.class);

    private final MyPlayerAccess myPlayerAccess;
    private final MediaService mediaService;
    private final GalleryImageRepository imageRepository;
    private final GalleryImageTagRepository tagRepository;
    private final LeagueRepository leagueRepository;
    private final TeamRepository teamRepository;
    private final PlayerProfileRepository playerProfileRepository;
    private final PersonRepository personRepository;

    GalleryServiceImpl(
            MyPlayerAccess myPlayerAccess,
            MediaService mediaService,
            GalleryImageRepository imageRepository,
            GalleryImageTagRepository tagRepository,
            LeagueRepository leagueRepository,
            TeamRepository teamRepository,
            PlayerProfileRepository playerProfileRepository,
            PersonRepository personRepository) {
        this.myPlayerAccess = myPlayerAccess;
        this.mediaService = mediaService;
        this.imageRepository = imageRepository;
        this.tagRepository = tagRepository;
        this.leagueRepository = leagueRepository;
        this.teamRepository = teamRepository;
        this.playerProfileRepository = playerProfileRepository;
        this.personRepository = personRepository;
    }

    // --- Player Hub ---

    @Override
    @Transactional(readOnly = true)
    public GalleryPageDto list(Authentication authentication, String playerKey, GalleryQuery query, Integer page, Integer size) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        return pageOf(held.profile().getClubId(), held.caller().getId(), false, query, page, size);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GalleryImageDto> latest(Authentication authentication, String playerKey, Integer limit) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        int count = limit == null ? MAX_LATEST : limit;
        if (count < 1 || count > MAX_LATEST) {
            throw new ValidationException("limit must be between 1 and " + MAX_LATEST);
        }
        List<GalleryImage> rows = imageRepository.findByClubIdAndStatusOrderByUploadedAtDescIdDesc(
                held.profile().getClubId(), GalleryImage.PUBLISHED, PageRequest.of(0, count));
        return toDtos(rows, held.caller().getId(), false);
    }

    @Override
    @Transactional
    public GalleryImageDto upload(
            Authentication authentication,
            String playerKey,
            MultipartFile medium,
            MultipartFile thumb,
            String caption,
            UUID leagueId,
            UUID teamId,
            boolean tagMyPlayer) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        List<UUID> players = tagMyPlayer ? List.of(held.profile().getId()) : List.of();
        return create(held.profile().getClubId(), held.caller().getId(), false, medium, thumb, caption, leagueId, teamId, players);
    }

    @Override
    @Transactional(readOnly = true)
    public GalleryFiltersDto filters(Authentication authentication, String playerKey) {
        return filtersOf(myPlayerAccess.resolve(authentication, playerKey).profile().getClubId());
    }

    @Override
    @Transactional(readOnly = true)
    public GalleryFiltersDto filtersForClub(UUID clubId) {
        return filtersOf(clubId);
    }

    /** The tagged leagues, teams and players of the club, by name; a tag whose record is gone is left out. */
    private GalleryFiltersDto filtersOf(UUID clubId) {
        Map<String, Set<UUID>> ids = new HashMap<>();
        for (Object[] row : imageRepository.tagsInUse(clubId)) {
            ids.computeIfAbsent((String) row[0], key -> new LinkedHashSet<>()).add((UUID) row[1]);
        }
        return new GalleryFiltersDto(
                options(GalleryImageTag.LEAGUE, ids.getOrDefault(GalleryImageTag.LEAGUE, Set.of()),
                        found -> leagueRepository.findAllById(found).stream().collect(Collectors.toMap(League::getId, League::getName))),
                options(GalleryImageTag.TEAM, ids.getOrDefault(GalleryImageTag.TEAM, Set.of()),
                        found -> teamRepository.findAllById(found).stream().collect(Collectors.toMap(Team::getId, Team::getName))),
                options(GalleryImageTag.PLAYER, ids.getOrDefault(GalleryImageTag.PLAYER, Set.of()), this::playerNames));
    }

    private static List<GalleryTagDto> options(
            String type, Set<UUID> ids, java.util.function.Function<Set<UUID>, Map<UUID, String>> lookup) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return lookup.apply(ids).entrySet().stream()
                .map(entry -> new GalleryTagDto(type, entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparing(GalleryTagDto::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Override
    @Transactional
    public void delete(Authentication authentication, String playerKey, UUID imageId) {
        HeldPlayer held = myPlayerAccess.resolve(authentication, playerKey);
        GalleryImage image = imageRepository.findById(imageId)
                .filter(found -> held.profile().getClubId().equals(found.getClubId()))
                .filter(found -> held.caller().getId().equals(found.getUploadedByPersonId()))
                .orElseThrow(() -> new NotFoundException("Photo not found"));
        remove(image);
    }

    // --- Manager ---

    @Override
    @Transactional(readOnly = true)
    public GalleryPageDto listForClub(UUID clubId, UUID callerPersonId, GalleryQuery query, Integer page, Integer size) {
        return pageOf(clubId, callerPersonId, true, query, page, size);
    }

    @Override
    @Transactional
    public GalleryImageDto uploadForClub(
            UUID clubId,
            UUID callerPersonId,
            MultipartFile medium,
            MultipartFile thumb,
            String caption,
            UUID leagueId,
            UUID teamId,
            List<UUID> playerIds) {
        return create(clubId, callerPersonId, true, medium, thumb, caption, leagueId, teamId, playerIds);
    }

    @Override
    @Transactional
    public void deleteForClub(UUID clubId, UUID imageId) {
        GalleryImage image = imageRepository.findById(imageId)
                .filter(found -> clubId.equals(found.getClubId()))
                .orElseThrow(() -> new NotFoundException("Photo not found"));
        remove(image);
    }

    // --- Shared ---

    private GalleryPageDto pageOf(UUID clubId, UUID callerId, boolean showUploader, GalleryQuery query, Integer page, Integer size) {
        int pageNumber = page == null ? 0 : page;
        int pageSize = size == null ? DEFAULT_SIZE : size;
        if (pageNumber < 0) {
            throw new ValidationException("page must not be negative");
        }
        if (pageSize < 1 || pageSize > MAX_SIZE) {
            throw new ValidationException("size must be between 1 and " + MAX_SIZE);
        }
        GalleryQuery filter = query == null ? new GalleryQuery(null, null, null, null) : query;
        String text = filter.q() == null ? "" : filter.q().trim();
        if (text.length() > MAX_QUERY_LENGTH) {
            throw new ValidationException("q must be at most " + MAX_QUERY_LENGTH + " characters");
        }
        String pattern = "%" + text.toLowerCase(Locale.ROOT).replace("\\", "").replace("%", "").replace("_", "") + "%";
        Page<GalleryImage> rows = imageRepository.search(
                clubId,
                filter.leagueId() == null, filter.leagueId() == null ? NO_ID : filter.leagueId(),
                filter.teamId() == null, filter.teamId() == null ? NO_ID : filter.teamId(),
                filter.playerId() == null, filter.playerId() == null ? NO_ID : filter.playerId(),
                text.isEmpty(), pattern,
                PageRequest.of(pageNumber, pageSize));
        return new GalleryPageDto(toDtos(rows.getContent(), callerId, showUploader), pageNumber, pageSize, rows.getTotalElements(), rows.hasNext());
    }

    private GalleryImageDto create(
            UUID clubId,
            UUID personId,
            boolean showUploader,
            MultipartFile medium,
            MultipartFile thumb,
            String caption,
            UUID leagueId,
            UUID teamId,
            List<UUID> playerIds) {
        checkPhoto(medium, MAX_MEDIUM_BYTES, "medium");
        checkPhoto(thumb, MAX_THUMB_BYTES, "thumb");
        String text = caption == null ? null : caption.trim();
        if (text != null && text.isEmpty()) {
            text = null;
        }
        if (text != null && text.length() > MAX_CAPTION_LENGTH) {
            throw new ValidationException("caption must be at most " + MAX_CAPTION_LENGTH + " characters");
        }
        Set<UUID> players = new LinkedHashSet<>(playerIds == null ? List.of() : playerIds);
        if (players.size() > MAX_PLAYER_TAGS) {
            throw new ValidationException("at most " + MAX_PLAYER_TAGS + " players can be tagged");
        }
        checkTags(clubId, leagueId, teamId, players);
        if (imageRepository.countByUploadedByPersonIdAndUploadedAtAfter(personId, Instant.now().minus(Duration.ofHours(24))) >= DAILY_LIMIT) {
            throw new LinkRateLimitedException(Duration.ofHours(1).toSeconds());
        }

        String mediumUrl = mediaService.upload(medium, JPEG_ONLY).url();
        String thumbUrl;
        try {
            thumbUrl = mediaService.upload(thumb, JPEG_ONLY).url();
        } catch (RuntimeException e) {
            mediaService.delete(mediumUrl);
            throw e;
        }
        GalleryImage image = imageRepository.save(GalleryImage.builder()
                .clubId(clubId)
                .uploadedByPersonId(personId)
                .uploadedAt(Instant.now())
                .caption(text)
                .mediumUrl(mediumUrl)
                .thumbUrl(thumbUrl)
                .status(GalleryImage.PUBLISHED)
                .build());
        List<GalleryImageTag> tags = new ArrayList<>();
        if (leagueId != null) {
            tags.add(tag(image, GalleryImageTag.LEAGUE, leagueId));
        }
        if (teamId != null) {
            tags.add(tag(image, GalleryImageTag.TEAM, teamId));
        }
        players.forEach(playerId -> tags.add(tag(image, GalleryImageTag.PLAYER, playerId)));
        tagRepository.saveAll(tags);
        // Ids only: who added a photo, never a name or a caption.
        log.info("Gallery photo added: clubId={} imageId={} personId={} tags={}", clubId, image.getId(), personId, tags.size());
        return toDtos(List.of(image), personId, showUploader).get(0);
    }

    private static GalleryImageTag tag(GalleryImage image, String type, UUID id) {
        return GalleryImageTag.builder().imageId(image.getId()).tagType(type).tagId(id).build();
    }

    /** A league, a team and each player must belong to the club; anything else is a 404, as for a record of another club. */
    private void checkTags(UUID clubId, UUID leagueId, UUID teamId, Collection<UUID> playerIds) {
        if (leagueId != null) {
            leagueRepository.findById(leagueId).filter(league -> clubId.equals(league.getClubId()))
                    .orElseThrow(() -> new NotFoundException("League not found"));
        }
        if (teamId != null) {
            teamRepository.findById(teamId).filter(team -> clubId.equals(team.getClubId()))
                    .orElseThrow(() -> new NotFoundException("Team not found"));
        }
        for (UUID playerId : playerIds) {
            playerProfileRepository.findById(playerId).filter(player -> clubId.equals(player.getClubId()))
                    .orElseThrow(() -> new NotFoundException("Player not found"));
        }
    }

    /** One JPEG, inside its size cap, that really decodes as an image (the content type alone is the client's word). */
    private static void checkPhoto(MultipartFile file, long maxBytes, String name) {
        if (file == null || file.isEmpty()) {
            throw new ValidationException(name + " photo is required");
        }
        if (!"image/jpeg".equals(file.getContentType())) {
            throw new UnsupportedMediaTypeException("Unsupported media type: " + file.getContentType());
        }
        if (file.getSize() > maxBytes) {
            throw new ValidationException(name + " photo is too large");
        }
        try {
            BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(file.getBytes()));
            if (decoded == null) {
                throw new ValidationException(name + " photo is not a readable image");
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read the uploaded photo", e);
        }
    }

    private void remove(GalleryImage image) {
        imageRepository.delete(image);
        imageRepository.flush();
        mediaService.delete(image.getMediumUrl());
        mediaService.delete(image.getThumbUrl());
        log.info("Gallery photo deleted: clubId={} imageId={}", image.getClubId(), image.getId());
    }

    /** The photos as DTOs: the tags and their names read once for the whole page, not once per photo. */
    private List<GalleryImageDto> toDtos(List<GalleryImage> images, UUID callerId, boolean showUploader) {
        if (images.isEmpty()) {
            return List.of();
        }
        List<UUID> imageIds = images.stream().map(GalleryImage::getId).toList();
        Map<UUID, List<GalleryImageTag>> tagsByImage = tagRepository.findByImageIdIn(imageIds).stream()
                .collect(Collectors.groupingBy(GalleryImageTag::getImageId));
        Map<UUID, String> leagueNames = names(tagsByImage, GalleryImageTag.LEAGUE,
                ids -> leagueRepository.findAllById(ids).stream().collect(Collectors.toMap(League::getId, League::getName)));
        Map<UUID, String> teamNames = names(tagsByImage, GalleryImageTag.TEAM,
                ids -> teamRepository.findAllById(ids).stream().collect(Collectors.toMap(Team::getId, Team::getName)));
        Map<UUID, String> playerNames = names(tagsByImage, GalleryImageTag.PLAYER, this::playerNames);
        Map<UUID, String> uploaderNames = showUploader
                ? personNames(images.stream().map(GalleryImage::getUploadedByPersonId).collect(Collectors.toSet()))
                : Map.of();

        return images.stream().map(image -> {
            List<GalleryTagDto> tags = tagsByImage.getOrDefault(image.getId(), List.of()).stream()
                    .map(tag -> new GalleryTagDto(tag.getTagType(), tag.getTagId(), switch (tag.getTagType()) {
                        case GalleryImageTag.LEAGUE -> leagueNames.get(tag.getTagId());
                        case GalleryImageTag.TEAM -> teamNames.get(tag.getTagId());
                        default -> playerNames.get(tag.getTagId());
                    }))
                    .filter(tag -> tag.name() != null)
                    .sorted(Comparator.comparing(GalleryTagDto::type).thenComparing(GalleryTagDto::name))
                    .toList();
            return new GalleryImageDto(
                    image.getId(),
                    image.getThumbUrl(),
                    image.getMediumUrl(),
                    image.getCaption(),
                    image.getUploadedAt(),
                    showUploader ? uploaderNames.get(image.getUploadedByPersonId()) : null,
                    callerId.equals(image.getUploadedByPersonId()),
                    tags);
        }).toList();
    }

    private static Map<UUID, String> names(
            Map<UUID, List<GalleryImageTag>> tagsByImage, String type, java.util.function.Function<Set<UUID>, Map<UUID, String>> lookup) {
        Set<UUID> ids = tagsByImage.values().stream().flatMap(List::stream)
                .filter(tag -> type.equals(tag.getTagType())).map(GalleryImageTag::getTagId).collect(Collectors.toSet());
        return ids.isEmpty() ? Map.of() : lookup.apply(ids);
    }

    private Map<UUID, String> playerNames(Set<UUID> profileIds) {
        List<PlayerProfile> profiles = playerProfileRepository.findAllById(profileIds);
        Map<UUID, String> byPerson = personNames(profiles.stream().map(PlayerProfile::getPersonId).collect(Collectors.toSet()));
        Map<UUID, String> result = new HashMap<>();
        profiles.forEach(profile -> {
            String name = byPerson.get(profile.getPersonId());
            if (name != null) {
                result.put(profile.getId(), name);
            }
        });
        return result;
    }

    private Map<UUID, String> personNames(Set<UUID> personIds) {
        Map<UUID, String> result = new HashMap<>();
        for (Person person : personRepository.findAllById(personIds)) {
            result.put(person.getId(), (person.getFirstName() + " " + person.getLastName()).trim());
        }
        return result;
    }
}
