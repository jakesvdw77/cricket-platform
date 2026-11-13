package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonLinkStatus;
import com.cricketlegend.domain.PersonStatus;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * docs/specs/148-player-hub-club-info.md, Integration: who may read Club info and its contact directory
 * ({@code /api/v1/me/players/{playerKey}/club-info[/contacts]}), the no-store header and the audit log line.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerClubInfoAccessIntegrationTest extends AbstractClubInfoIntegrationTest {

    private static final String LOGGER = "com.cricketlegend.service.impl.MyClubInfoServiceImpl";

    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private Logger logger;

    @BeforeEach
    void captureLogs() {
        logger = (Logger) LoggerFactory.getLogger(LOGGER);
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach
    void releaseLogs() {
        logger.detachAppender(logs);
        logs.stop();
    }

    /** A club with the directory on and one contact, a parent linked to a child, plus the child's link. */
    private record Fx(Club club, Person parent, PersonLink mainLink) {}

    private Fx fx() {
        Club club = clubWithProfile();
        switches(club, true, true, true);
        contact(club, "Cathy", "Clubber", "Secretary", "0825550001", "cathy@hillcrest.test");
        Person parent = account("Pat", "Parent");
        Person kid = playerPerson("Sam", "Smith", CHILD_DOB);
        profile(club, kid, null);
        return new Fx(club, parent, link(parent, kid, club, true));
    }

    @Test
    void anAdultPlayerReadsTheirOwnClubInfoAndContacts() throws Exception {
        Fx f = fx();
        Own me = adultSelf(f.club());

        mockMvc.perform(info(me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clubName").value(f.club().getName()))
                .andExpect(jsonPath("$.directory.total").value(1));
        mockMvc.perform(contacts(me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].lastName").value("Clubber"));
    }

    @Test
    void aLinkedMainParentReadsBoth() throws Exception {
        Fx f = fx();
        String key = f.mainLink().getId().toString();

        mockMvc.perform(info(key).with(as(f.parent()))).andExpect(status().isOk());
        mockMvc.perform(contacts(key).with(as(f.parent()))).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void aLinkedNonMainAgentReadsBoth() throws Exception {
        Fx f = fx();
        Person agent = account("Al", "Agent");
        PersonLink agentLink = link(agent, personRepository.findById(f.mainLink().getSubjectPersonId()).orElseThrow(), f.club(), false);
        String key = agentLink.getId().toString();

        mockMvc.perform(info(key).with(as(agent))).andExpect(status().isOk())
                .andExpect(jsonPath("$.directory.total").value(1));
        mockMvc.perform(contacts(key).with(as(agent))).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void aJuniorsOwnLoginGetsClubInfoButNotTheDirectory() throws Exception {
        Fx f = fx();
        Own kid = juniorSelf(f.club());

        mockMvc.perform(info(kid.key()).with(as(kid.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.directory").value((Object) null))
                .andExpect(jsonPath("$.tabs[?(@.id=='contacts')]").isEmpty())
                .andExpect(jsonPath("$.about").isNotEmpty());
        mockMvc.perform(contacts(kid.key()).with(as(kid.person())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Contacts are not shared"));
    }

    @Test
    void aJuniorsOwnLoginAsksForBadParametersAndStillGetsNotFound() throws Exception {
        Fx f = fx();
        Own kid = juniorSelf(f.club());

        mockMvc.perform(contacts(kid.key()).param("size", "500").param("sort", "x").param("letter", "AB").with(as(kid.person())))
                .andExpect(status().isNotFound());
    }

    @Test
    void aClubWithTheDirectoryOffAnswersNotFoundOnContactsBeforeValidation() throws Exception {
        Fx f = fx();
        switches(f.club(), false, false, false);
        String key = f.mainLink().getId().toString();

        mockMvc.perform(contacts(key).with(as(f.parent()))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Contacts are not shared"));
        mockMvc.perform(contacts(key).param("size", "500").with(as(f.parent()))).andExpect(status().isNotFound());
        mockMvc.perform(info(key).with(as(f.parent()))).andExpect(status().isOk())
                .andExpect(jsonPath("$.directory").value((Object) null));
    }

    @Test
    void aKeyOfAnotherAccountIsNotFoundOnBothReads() throws Exception {
        Fx f = fx();
        Fx other = fx();
        String foreign = other.mainLink().getId().toString();

        mockMvc.perform(info(foreign).with(as(f.parent()))).andExpect(status().isNotFound());
        mockMvc.perform(contacts(foreign).with(as(f.parent()))).andExpect(status().isNotFound());
        Own stranger = adultSelf(other.club());
        mockMvc.perform(info(stranger.key()).with(as(f.parent()))).andExpect(status().isNotFound());
        mockMvc.perform(contacts(stranger.key()).with(as(f.parent()))).andExpect(status().isNotFound());
    }

    @Test
    void aMalformedKeyIsNotFound() throws Exception {
        Fx f = fx();

        for (String key : List.of("garbage", "self:not-a-uuid", "self:", "00000000-0000-0000-0000-000000000000")) {
            mockMvc.perform(info(key).with(as(f.parent()))).andExpect(status().isNotFound());
            mockMvc.perform(contacts(key).with(as(f.parent()))).andExpect(status().isNotFound());
        }
    }

    @Test
    void aRevokedLinkIsNotFound() throws Exception {
        Fx f = fx();
        String key = f.mainLink().getId().toString();
        mockMvc.perform(info(key).with(as(f.parent()))).andExpect(status().isOk());
        f.mainLink().setStatus(PersonLinkStatus.REVOKED);
        personLinkRepository.save(f.mainLink());

        mockMvc.perform(info(key).with(as(f.parent()))).andExpect(status().isNotFound());
        mockMvc.perform(contacts(key).with(as(f.parent()))).andExpect(status().isNotFound());
    }

    @Test
    void aSuspendedCallerIsForbidden() throws Exception {
        Fx f = fx();
        String key = f.mainLink().getId().toString();
        f.parent().setStatus(PersonStatus.SUSPENDED);
        personRepository.save(f.parent());

        mockMvc.perform(info(key).with(as(f.parent()))).andExpect(status().isForbidden());
        mockMvc.perform(contacts(key).with(as(f.parent()))).andExpect(status().isForbidden());
    }

    @Test
    void anUnauthenticatedRequestIsUnauthorized() throws Exception {
        Fx f = fx();
        String key = f.mainLink().getId().toString();

        mockMvc.perform(info(key)).andExpect(status().isUnauthorized());
        mockMvc.perform(contacts(key)).andExpect(status().isUnauthorized());
    }

    @Test
    void clubAIsolationAPlayerOfClubANeverSeesClubBsContacts() throws Exception {
        Fx a = fx();
        Fx b = fx();
        contact(b.club(), "Zelda", "Zebra", "Chair", "0820000099", "zelda@b.test");
        String key = a.mainLink().getId().toString();

        String body = mockMvc.perform(contacts(key).param("size", "50").with(as(a.parent())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String search = mockMvc.perform(contacts(key).param("query", "Zebra").with(as(a.parent())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty()).andReturn().getResponse().getContentAsString();

        assertThat(body).contains("Clubber").doesNotContain("Zebra").doesNotContain("0820000099").doesNotContain("zelda@b.test");
        assertThat(search).doesNotContain("Zebra");
        assertThat(tree(body).get("total").asLong()).isEqualTo(1);
        mockMvc.perform(info(key).with(as(a.parent())))
                .andExpect(jsonPath("$.clubName").value(a.club().getName()));
    }

    @Test
    void bothReadsAreNeverCached() throws Exception {
        Fx f = fx();
        String key = f.mainLink().getId().toString();

        for (var request : List.of(info(key), contacts(key))) {
            String cacheControl = mockMvc.perform(request.with(as(f.parent()))).andExpect(status().isOk())
                    .andExpect(header().exists("Cache-Control")).andReturn().getResponse().getHeader("Cache-Control");
            assertThat(cacheControl).contains("no-store").contains("private");
        }
    }

    @Test
    void theDirectoryReadWritesOneInfoLineWithIdsAndCountsAndNoPersonalData() throws Exception {
        Fx f = fx();
        contact(f.club(), "Dora", "Distinct", "Umpire", "0826660002", "dora@hillcrest.test");
        String key = f.mainLink().getId().toString();

        logs.list.clear();
        mockMvc.perform(info(key).with(as(f.parent()))).andExpect(status().isOk());
        assertThat(logs.list).as("Club info itself writes no audit line").isEmpty();

        mockMvc.perform(contacts(key).param("query", "Distinct").with(as(f.parent()))).andExpect(status().isOk());

        List<ILoggingEvent> infoLines = logs.list.stream().filter(e -> e.getLevel() == Level.INFO).toList();
        assertThat(infoLines).hasSize(1);
        String line = infoLines.get(0).getFormattedMessage();
        assertThat(line).contains(f.club().getId().toString()).contains(f.parent().getId().toString())
                .contains("returned=1").contains("total=1");
        assertThat(line).doesNotContain("Distinct").doesNotContain("Dora").doesNotContain("Cathy").doesNotContain("Clubber")
                .doesNotContain("0826660002").doesNotContain("0825550001").doesNotContain("@hillcrest.test").doesNotContain("Umpire");
        assertThat(logs.list).hasSize(1);
    }

    @Test
    void aRefusedDirectoryReadWritesNoAuditLine() throws Exception {
        Fx f = fx();
        Own kid = juniorSelf(f.club());

        logs.list.clear();
        mockMvc.perform(contacts(kid.key()).with(as(kid.person()))).andExpect(status().isNotFound());

        assertThat(logs.list).isEmpty();
    }
}
