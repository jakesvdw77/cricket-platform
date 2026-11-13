package com.cricketlegend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.ClubProfileType;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.TeamContactRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Fixtures for the docs/specs/148 Club info integration tests. Not transactional (the {@code open-in-view=false} trap in
 * docs/standards/backend.md): everything is committed under unique club ids and the club contacts it creates are removed
 * in {@code @AfterEach}.
 */
abstract class AbstractClubInfoIntegrationTest extends AbstractLinkIntegrationTest {

    protected static final LocalDate ADULT_DOB = LocalDate.of(1990, 3, 3);
    protected static final LocalDate JUNIOR_DOB = LocalDate.now().minusYears(11);
    protected static final ObjectMapper JSON = new ObjectMapper();

    @Autowired protected MockMvc mockMvc;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected ClubContactRepository clubContactRepository;
    @Autowired protected TeamContactRepository teamContactRepository;
    @Autowired protected ClubProfileRepository clubProfileRepository;

    private final List<UUID> clubIds = new ArrayList<>();

    @AfterEach
    void removeClubInfoRows() {
        for (UUID id : clubIds) {
            jdbc.update("delete from team_contact where club_contact_id in (select id from club_contact where club_id = ?)", id);
            jdbc.update("delete from club_contact where club_id = ?", id);
        }
        clubIds.clear();
    }

    protected void track(Club club) {
        clubIds.add(club.getId());
    }

    /** A club with a fully filled profile row, the default Club info switches and nothing else. */
    protected Club clubWithProfile() {
        Club club = club("Hillcrest");
        clubIds.add(club.getId());
        clubProfileRepository.save(ClubProfile.builder().clubId(club.getId()).type(ClubProfileType.CLUB)
                .email("club@hillcrest.test").phone("0215550000").website("https://hillcrest.test")
                .logoUrl("/media/logo-" + unique("l") + ".png").bannerUrl("/media/banner-" + unique("b") + ".png")
                .address(Address.builder().number("1").street("High St").city("Cape Town").provinceState("WC")
                        .country("ZA").postalCode("8000").build())
                .socialLinks(new ArrayList<>(List.of(SocialLink.builder().platform("Facebook").url("https://facebook.com/hillcrest").build())))
                .build());
        return club;
    }

    /** Sets the Club info switches straight in SQL, so combinations the settings service refuses can be tested too. */
    protected void switches(Club club, boolean directory, boolean phone, boolean email) {
        jdbc.update("update club_profile set hub_info_directory = ?, hub_info_directory_phone = ?, hub_info_directory_email = ? where club_id = ?",
                directory, phone, email, club.getId());
    }

    protected void setSwitch(Club club, String column, boolean value) {
        jdbc.update("update club_profile set " + column + " = ? where club_id = ?", value, club.getId());
    }

    protected ClubContact contact(Club club, String first, String last, String role, String phone, String email) {
        return contact(club, first, last, role, phone, email, true);
    }

    protected ClubContact contact(Club club, String first, String last, String role, String phone, String email, boolean active) {
        clubIds.add(club.getId());
        return clubContactRepository.save(ClubContact.builder().clubId(club.getId())
                .contact(Contact.builder().firstName(first).lastName(last).phone(phone).email(email).build())
                .role(role).isPrimary(false).active(active).build());
    }

    /** An adult player who logs in: ACTIVE, with a verified own record at the club. Returns the person; the key is {@code self:<profileId>}. */
    protected record Own(Person person, PlayerProfile profile) {
        String key() {
            return "self:" + profile.getId();
        }
    }

    protected Own adultSelf(Club club) {
        return own(club, ADULT_DOB);
    }

    protected Own juniorSelf(Club club) {
        return own(club, JUNIOR_DOB);
    }

    private Own own(Club club, LocalDate dob) {
        Person person = personRepository.save(Person.builder().firstName("Own").lastName("Player").dateOfBirth(dob)
                .email(unique("own") + "@example.com").keycloakUserId(unique("sub")).status(PersonStatus.ACTIVE).build());
        return new Own(person, profile(club, person, null));
    }

    protected MockHttpServletRequestBuilder info(String key) {
        return get("/api/v1/me/players/{k}/club-info", key);
    }

    protected MockHttpServletRequestBuilder contacts(String key) {
        return get("/api/v1/me/players/{k}/club-info/contacts", key);
    }

    protected static JsonNode tree(String json) throws Exception {
        return JSON.readTree(json);
    }

    protected static Set<String> keys(JsonNode node) {
        Set<String> keys = new TreeSet<>();
        node.fieldNames().forEachRemaining(keys::add);
        return keys;
    }

    protected static Set<String> setOf(String... values) {
        return new TreeSet<>(List.of(values));
    }
}
