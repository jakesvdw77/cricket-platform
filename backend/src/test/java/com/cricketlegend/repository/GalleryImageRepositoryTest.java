package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.GalleryImage;
import com.cricketlegend.domain.GalleryImageTag;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Team;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/157-photo-gallery.md, "new custom repository query -> integration test": the gallery search (club, filters, text,
 * paging, newest first), the latest list, the tags in use and the daily count, against real Postgres.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
@Transactional
class GalleryImageRepositoryTest extends AbstractLinkIntegrationTest {

    private static final UUID NONE = new UUID(0L, 0L);

    @Autowired private GalleryImageRepository images;
    @Autowired private GalleryImageTagRepository tags;
    @Autowired private LeagueRepository leagueRepository;

    private GalleryImage photo(Club club, Person by, String caption, long minutesAgo) {
        return images.save(GalleryImage.builder().clubId(club.getId()).uploadedByPersonId(by.getId())
                .uploadedAt(Instant.now().minus(minutesAgo, ChronoUnit.MINUTES)).caption(caption)
                .mediumUrl("/media/" + UUID.randomUUID() + ".jpg").thumbUrl("/media/" + UUID.randomUUID() + ".jpg")
                .status(GalleryImage.PUBLISHED).build());
    }

    private void tag(GalleryImage image, String type, UUID id) {
        tags.save(GalleryImageTag.builder().imageId(image.getId()).tagType(type).tagId(id).build());
    }

    private Page<GalleryImage> search(Club club, UUID league, UUID team, UUID player, String text, int page, int size) {
        String pattern = "%" + text.toLowerCase() + "%";
        return images.search(club.getId(),
                league == null, league == null ? NONE : league,
                team == null, team == null ? NONE : team,
                player == null, player == null ? NONE : player,
                text.isEmpty(), pattern, PageRequest.of(page, size));
    }

    @Test
    void searchIsNewestFirstPagedAndOnlyForThisClubAndPublishedPhotos() {
        Club club = club("Hillcrest");
        Club other = club("Beta");
        Person by = account("Pat", "Parent");
        GalleryImage old = photo(club, by, "old", 30);
        GalleryImage mid = photo(club, by, "mid", 20);
        GalleryImage fresh = photo(club, by, "fresh", 10);
        photo(other, by, "elsewhere", 5);
        GalleryImage hidden = photo(club, by, "hidden", 1);
        hidden.setStatus("PENDING");
        images.save(hidden);

        Page<GalleryImage> first = search(club, null, null, null, "", 0, 2);
        assertThat(first.getContent()).extracting(GalleryImage::getId).containsExactly(fresh.getId(), mid.getId());
        assertThat(first.getTotalElements()).isEqualTo(3);
        assertThat(first.hasNext()).isTrue();
        assertThat(search(club, null, null, null, "", 1, 2).getContent()).extracting(GalleryImage::getId).containsExactly(old.getId());
    }

    @Test
    void filtersByLeagueTeamAndPlayerAndCombinesThem() {
        Club club = club("Hillcrest");
        Person by = account("Pat", "Parent");
        UUID league = UUID.randomUUID();
        UUID team = UUID.randomUUID();
        UUID player = UUID.randomUUID();
        GalleryImage a = photo(club, by, "a", 3);
        tag(a, GalleryImageTag.LEAGUE, league);
        tag(a, GalleryImageTag.TEAM, team);
        GalleryImage b = photo(club, by, "b", 2);
        tag(b, GalleryImageTag.LEAGUE, league);
        tag(b, GalleryImageTag.PLAYER, player);
        photo(club, by, "untagged", 1);

        assertThat(search(club, league, null, null, "", 0, 10).getContent()).extracting(GalleryImage::getCaption).containsExactly("b", "a");
        assertThat(search(club, null, team, null, "", 0, 10).getContent()).extracting(GalleryImage::getCaption).containsExactly("a");
        assertThat(search(club, null, null, player, "", 0, 10).getContent()).extracting(GalleryImage::getCaption).containsExactly("b");
        assertThat(search(club, league, team, null, "", 0, 10).getContent()).extracting(GalleryImage::getCaption).containsExactly("a");
        assertThat(search(club, league, team, player, "", 0, 10).getContent()).isEmpty();
    }

    @Test
    void textSearchMatchesTheCaptionAndTheNamesOfTaggedLeaguesTeamsAndPlayers() {
        Club club = club("Hillcrest");
        Person by = account("Pat", "Parent");
        League league = leagueRepository.save(League.builder().clubId(club.getId()).name("VCASA Club Champs")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        Team team = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section(club, "Vets").getId())
                .name("Delta CC").active(true).build());
        PlayerProfile player = profile(club, playerPerson("Willie", "Prinsloo", CHILD_DOB), "w@example.com");

        GalleryImage byLeague = photo(club, by, null, 4);
        tag(byLeague, GalleryImageTag.LEAGUE, league.getId());
        GalleryImage byTeam = photo(club, by, null, 3);
        tag(byTeam, GalleryImageTag.TEAM, team.getId());
        GalleryImage byPlayer = photo(club, by, null, 2);
        tag(byPlayer, GalleryImageTag.PLAYER, player.getId());
        GalleryImage byCaption = photo(club, by, "Trophy time", 1);

        assertThat(search(club, null, null, null, "vcasa", 0, 10).getContent()).extracting(GalleryImage::getId).containsExactly(byLeague.getId());
        assertThat(search(club, null, null, null, "delta", 0, 10).getContent()).extracting(GalleryImage::getId).containsExactly(byTeam.getId());
        assertThat(search(club, null, null, null, "willie pri", 0, 10).getContent()).extracting(GalleryImage::getId).containsExactly(byPlayer.getId());
        assertThat(search(club, null, null, null, "trophy", 0, 10).getContent()).extracting(GalleryImage::getId).containsExactly(byCaption.getId());
        assertThat(search(club, null, null, null, "nothing like this", 0, 10).getContent()).isEmpty();
    }

    @Test
    void latestIsCappedByThePageSizeAndNewestFirst() {
        Club club = club("Hillcrest");
        Person by = account("Pat", "Parent");
        for (int i = 0; i < 5; i++) {
            photo(club, by, "p" + i, 50 - i);
        }
        List<GalleryImage> latest = images.findByClubIdAndStatusOrderByUploadedAtDescIdDesc(club.getId(), GalleryImage.PUBLISHED, PageRequest.of(0, 3));
        assertThat(latest).extracting(GalleryImage::getCaption).containsExactly("p4", "p3", "p2");
    }

    @Test
    void tagsInUseListsTheDistinctTagsOfThisClubsPublishedPhotosOnly() {
        Club club = club("Hillcrest");
        Club other = club("Beta");
        Person by = account("Pat", "Parent");
        UUID league = UUID.randomUUID();
        UUID elsewhere = UUID.randomUUID();
        GalleryImage a = photo(club, by, "a", 2);
        GalleryImage b = photo(club, by, "b", 1);
        tag(a, GalleryImageTag.LEAGUE, league);
        tag(b, GalleryImageTag.LEAGUE, league);
        tag(photo(other, by, "x", 1), GalleryImageTag.TEAM, elsewhere);

        List<Object[]> used = images.tagsInUse(club.getId());
        assertThat(used).hasSize(1);
        assertThat(used.get(0)[0]).isEqualTo(GalleryImageTag.LEAGUE);
        assertThat(used.get(0)[1]).isEqualTo(league);
    }

    @Test
    void countsAPersonsPhotosInTheLastDayOnly() {
        Club club = club("Hillcrest");
        Person by = account("Pat", "Parent");
        photo(club, by, "today", 60);
        photo(club, by, "also today", 120);
        photo(club, by, "last week", 60 * 24 * 7);
        assertThat(images.countByUploadedByPersonIdAndUploadedAtAfter(by.getId(), Instant.now().minus(24, ChronoUnit.HOURS))).isEqualTo(2);
    }

    @Test
    void deletingAPhotoRemovesItsTagsInTheDatabase() {
        Club club = club("Hillcrest");
        Person by = account("Pat", "Parent");
        GalleryImage image = photo(club, by, "a", 1);
        tag(image, GalleryImageTag.TEAM, UUID.randomUUID());
        images.flush();
        images.delete(image);
        images.flush();
        assertThat(tags.findByImageIdIn(List.of(image.getId()))).isEmpty();
    }
}
