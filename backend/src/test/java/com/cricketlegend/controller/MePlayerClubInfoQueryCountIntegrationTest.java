package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import jakarta.persistence.EntityManagerFactory;
import java.util.function.Function;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * N+1 guard for docs/specs/148 ("fixed query counts"): both Club info reads issue the same number of SQL statements for a
 * club with one contact as for a club with forty. Same technique as {@code MePlayerStatsQueryCountIntegrationTest}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerClubInfoQueryCountIntegrationTest extends AbstractClubInfoIntegrationTest {

    private static final long GENEROUS_CEILING = 30;

    @Autowired private EntityManagerFactory entityManagerFactory;

    private record Fx(Person parent, String key) {}

    private Fx club(int contacts) {
        Club club = clubWithProfile();
        switches(club, true, true, true);
        for (int i = 0; i < contacts; i++) {
            contact(club, "First" + i, "Last" + String.format("%02d", i), "Role" + (i % 5), "08200000" + String.format("%02d", i), "c" + i + "@hillcrest.test");
        }
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        profile(club, kid, null);
        return new Fx(parent, link(parent, kid, club, true).getId().toString());
    }

    private long statements(Fx fx, Function<String, MockHttpServletRequestBuilder> request) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        mockMvc.perform(request.apply(fx.key()).with(as(fx.parent()))).andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }

    private void sameForOneAndForty(String name, Function<String, MockHttpServletRequestBuilder> request) throws Exception {
        Fx one = club(1);
        Fx forty = club(40);
        statements(one, request);
        statements(forty, request);
        long oneCount = statements(one, request);
        long fortyCount = statements(forty, request);
        assertThat(fortyCount).as(name + ": forty contacts issue the same statements as one").isEqualTo(oneCount);
        assertThat(oneCount).as(name + " statements").isBetween(1L, GENEROUS_CEILING);
    }

    @Test
    void clubInfoIssuesAFixedNumberOfStatements() throws Exception {
        sameForOneAndForty("club-info", this::info);
    }

    @Test
    void theContactPageIssuesAFixedNumberOfStatementsForEverySortAndFilter() throws Exception {
        sameForOneAndForty("contacts", k -> contacts(k).param("size", "50"));
        sameForOneAndForty("contacts by role", k -> contacts(k).param("sort", "role").param("size", "10"));
        sameForOneAndForty("contacts query and letter", k -> contacts(k).param("query", "first").param("letter", "L").param("size", "10"));
    }
}
