package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PublicAvailabilityAttempt;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The two custom queries behind the 077 public verify: the atomic attempt-counter upsert and the
 * batch date-of-birth lookup. Not {@code @Transactional}; data is removed in {@code @AfterEach}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class PublicAvailabilityRepositoryIntegrationTest {

    @Autowired private PublicAvailabilityAttemptRepository attempts;
    @Autowired private PlayerProfileRepository profiles;
    @Autowired private PersonRepository persons;
    @Autowired private ClubRepository clubs;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanUp() {
        jdbcTemplate.execute("TRUNCATE TABLE club, person, public_availability_attempt CASCADE");
    }

    private int increment(String key, long now, int max) {
        attempts.increment(key, now, now - 900, max, now + 900);
        return attempts.readCounter(key).getFailedCount();
    }

    @Test
    void incrementCountsUpAndLocksWhenTheMaximumIsReached() {
        long now = Instant.now().getEpochSecond();

        for (int expected = 1; expected <= 4; expected++) {
            assertThat(increment("name:a", now, 5)).isEqualTo(expected);
        }
        assertThat(attempts.findById("name:a")).get().satisfies(row -> assertThat(row.getLockedUntil()).isNull());

        assertThat(increment("name:a", now, 5)).isEqualTo(5);

        PublicAvailabilityAttempt locked = attempts.findById("name:a").orElseThrow();
        assertThat(locked.getLockedUntil()).isEqualTo(Instant.ofEpochSecond(now + 900));
        assertThat(locked.getWindowStartedAt()).isEqualTo(Instant.ofEpochSecond(now));
    }

    @Test
    void aWindowOlderThanTheCutoffRestartsTheCounterAndClearsTheLock() {
        long now = Instant.now().getEpochSecond();
        for (int i = 0; i < 5; i++) {
            increment("name:b", now - 1000, 5);
        }
        assertThat(attempts.findById("name:b").orElseThrow().getLockedUntil()).isNotNull();

        assertThat(increment("name:b", now, 5)).isEqualTo(1);

        PublicAvailabilityAttempt row = attempts.findById("name:b").orElseThrow();
        assertThat(row.getLockedUntil()).isNull();
        assertThat(row.getWindowStartedAt()).isEqualTo(Instant.ofEpochSecond(now));
    }

    @Test
    void keysAreIndependentAndDeleteRemovesOnlyTheNamedKey() {
        long now = Instant.now().getEpochSecond();
        increment("name:c", now, 5);
        increment("ip:1.2.3.4", now, 31);

        assertThat(attempts.deleteByKey("name:c")).isEqualTo(1);

        assertThat(attempts.findById("name:c")).isEmpty();
        assertThat(attempts.findById("ip:1.2.3.4")).isPresent();
        assertThat(attempts.deleteByKey("name:c")).isZero();
    }

    @Test
    void concurrentIncrementsNeverUndercount() throws Exception {
        long now = Instant.now().getEpochSecond();
        int calls = 40;
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < calls; i++) {
                futures.add(pool.submit(() -> attempts.increment("name:race", now, now - 900, 1000, now + 900)));
            }
            for (Future<?> future : futures) {
                future.get();
            }
        } finally {
            pool.shutdown();
        }

        assertThat(attempts.readCounter("name:race").getFailedCount()).isEqualTo(calls);
    }

    @Test
    void activeDatesOfBirthAreLoadedInOneQueryAndSkipInactivePlayers() {
        Club club = clubs.save(Club.builder().name("c").slug("c-" + UUID.randomUUID()).status(ClubStatus.ACTIVE).build());
        UUID withDate = profile(club, LocalDate.of(1990, 5, 17), true);
        UUID withoutDate = profile(club, null, true);
        UUID inactive = profile(club, LocalDate.of(1980, 1, 1), false);
        UUID notAsked = profile(club, LocalDate.of(1970, 1, 1), true);

        List<PlayerDateOfBirthView> views = profiles.findActiveDatesOfBirth(List.of(withDate, withoutDate, inactive));

        assertThat(views).extracting(PlayerDateOfBirthView::getPlayerProfileId)
                .containsExactlyInAnyOrder(withDate, withoutDate)
                .doesNotContain(inactive, notAsked);
        assertThat(views).filteredOn(v -> v.getPlayerProfileId().equals(withDate))
                .extracting(PlayerDateOfBirthView::getDateOfBirth).containsExactly(LocalDate.of(1990, 5, 17));
        assertThat(views).filteredOn(v -> v.getPlayerProfileId().equals(withoutDate))
                .extracting(PlayerDateOfBirthView::getDateOfBirth).containsExactly((LocalDate) null);
    }

    private UUID profile(Club club, LocalDate dob, boolean active) {
        Person person = persons.save(Person.builder().firstName("F").lastName("L").dateOfBirth(dob).build());
        return profiles.save(PlayerProfile.builder().personId(person.getId()).clubId(club.getId()).active(active)
                .build()).getId();
    }
}
