package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withRole;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.domain.Subscription;
import com.cricketlegend.domain.SubscriptionOwnerType;
import com.cricketlegend.domain.SubscriptionStatus;
import com.cricketlegend.exception.EmailDeliveryException;
import com.cricketlegend.exception.KeycloakProvisioningException;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.ProductRepository;
import com.cricketlegend.repository.SubscriptionRepository;
import com.cricketlegend.service.KeycloakProvisioningService;
import com.cricketlegend.service.SubscriptionWelcomeEmailService;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for SubscriptionController — per docs/specs/009-subscriptions.md's
 * Test Plan and docs/plans/009-subscriptions.md's Test tier list: create/persist, validation,
 * ownerType/Club/Product business-rule conflicts, paginated list, get-by-id (found/missing),
 * update (mutates in place), cancel (including cancelling an already-cancelled subscription), and
 * platform_admin enforcement (401 unauthenticated AND 403 non-admin) on list and create.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * {@code ProductControllerIntegrationTest}'s convention.
 *
 * <p>{@code KeycloakProvisioningService} is {@code @MockitoBean}'d — per
 * docs/specs/016-keycloak-account-provisioning.md, {@code SubscriptionServiceImpl.create()} calls
 * it, and without a mock this test class would make a real network call to whatever
 * {@code app.keycloak.admin.server-url} resolves to (a local dev Keycloak that isn't running in
 * CI) on every test hitting {@code create()}. The real HTTP/DB layers under test here don't need
 * Keycloak reachable to be exercised — provisioning's own behavior is covered by
 * {@code SubscriptionServiceImplTest}'s mocked-service unit coverage and
 * {@code KeycloakProvisioningServiceImplTest}'s own unit coverage, not here.
 *
 * <p>{@code SubscriptionWelcomeEmailService} is {@code @MockitoBean}'d for the identical reason —
 * per docs/specs/017-subscription-welcome-email.md, {@code SubscriptionServiceImpl.create()} also
 * calls it, and without a mock this test class would attempt a real SMTP connection to whatever
 * {@code spring.mail.host}/{@code port} resolves to (a local Mailpit/Mailhog sink that isn't
 * running in CI) on every test hitting {@code create()}. The real HTTP/DB layers under test here
 * don't need SMTP reachable to be exercised — the welcome email's own content/rendering is covered
 * by {@code SubscriptionWelcomeEmailServiceImplTest}'s own unit coverage, not here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class SubscriptionControllerIntegrationTest {

    @MockitoBean
    private KeycloakProvisioningService keycloakProvisioningService;

    @MockitoBean
    private SubscriptionWelcomeEmailService subscriptionWelcomeEmailService;

    private static final String VALID_RESPONSIBLE_PERSON_JSON = """
            {
                "firstName": "Jane",
                "lastName": "Doe",
                "email": "jane.doe@example.com",
                "phone": "+27821234567"
            }""";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private PersonRepository personRepository;

    @Test
    void createValidSubscriptionPersistsAsActiveWithStatus201() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));

        String body = """
                {
                    "ownerType": "CLUB",
                    "ownerId": "%s",
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(club.getId(), product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.club.id").value(club.getId().toString()))
                .andExpect(jsonPath("$.club.name").value("Riverside CC"))
                .andExpect(jsonPath("$.product.id").value(product.getId().toString()))
                .andExpect(jsonPath("$.product.code").value("CLUB_STANDARD"))
                .andExpect(jsonPath("$.responsiblePerson.id").isNotEmpty())
                .andExpect(jsonPath("$.responsiblePerson.firstName").value("Jane"))
                .andExpect(jsonPath("$.responsiblePerson.email").value("jane.doe@example.com"));

        assertThat(subscriptionRepository.findAll()).hasSize(1);
        Subscription persisted = subscriptionRepository.findAll().get(0);
        Person persistedResponsiblePerson = personRepository.findById(persisted.getResponsiblePersonId())
                .orElseThrow();

        ArgumentCaptor<Person> personCaptor = ArgumentCaptor.forClass(Person.class);
        ArgumentCaptor<Subscription> subscriptionCaptor = ArgumentCaptor.forClass(Subscription.class);
        ArgumentCaptor<Club> clubCaptor = ArgumentCaptor.forClass(Club.class);
        ArgumentCaptor<Product> productCaptor = ArgumentCaptor.forClass(Product.class);
        verify(subscriptionWelcomeEmailService)
                .sendWelcomeEmail(
                        personCaptor.capture(), subscriptionCaptor.capture(), clubCaptor.capture(),
                        productCaptor.capture());
        assertThat(personCaptor.getValue().getId()).isEqualTo(persistedResponsiblePerson.getId());
        assertThat(subscriptionCaptor.getValue().getId()).isEqualTo(persisted.getId());
        assertThat(clubCaptor.getValue().getId()).isEqualTo(club.getId());
        assertThat(productCaptor.getValue().getId()).isEqualTo(product.getId());
    }

    @Test
    void createStillReturns201WhenKeycloakProvisioningThrows() throws Exception {
        // Strongest, end-to-end proof of judgment call #2
        // (docs/specs/016-keycloak-account-provisioning.md): a Keycloak outage during
        // Subscription creation never fails the HTTP request. SubscriptionServiceImplTest already
        // covers this at the unit layer with a mocked KeycloakProvisioningService; this proves it
        // one layer up, through the real controller/service/repository stack.
        doThrow(new KeycloakProvisioningException("Keycloak is unreachable", null))
                .when(keycloakProvisioningService)
                .provisionAccount(any());

        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));

        String body = """
                {
                    "ownerType": "CLUB",
                    "ownerId": "%s",
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(club.getId(), product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.club.id").value(club.getId().toString()));

        assertThat(subscriptionRepository.findAll()).hasSize(1);
    }

    @Test
    void createStillReturns201WhenSubscriptionWelcomeEmailServiceThrows() throws Exception {
        // Strongest, end-to-end proof of judgment call #3
        // (docs/specs/017-subscription-welcome-email.md): an SMTP outage during Subscription
        // creation never fails the HTTP request. SubscriptionServiceImplTest already covers this
        // at the unit layer with a mocked SubscriptionWelcomeEmailService; this proves it one
        // layer up, through the real controller/service/repository stack.
        doThrow(new EmailDeliveryException("SMTP is unreachable", null))
                .when(subscriptionWelcomeEmailService)
                .sendWelcomeEmail(any(), any(), any(), any());

        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));

        String body = """
                {
                    "ownerType": "CLUB",
                    "ownerId": "%s",
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(club.getId(), product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.club.id").value(club.getId().toString()));

        assertThat(subscriptionRepository.findAll()).hasSize(1);
    }

    @Test
    void createWithOwnerTypeSectionReturns400() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));

        String body = """
                {
                    "ownerType": "SECTION",
                    "ownerId": "%s",
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(club.getId(), product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        assertThat(subscriptionRepository.findAll()).isEmpty();
    }

    @Test
    void createWithMissingRequiredFieldsReturns400() throws Exception {
        String body = "{}";

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createWithMissingClubReturns404() throws Exception {
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));

        String body = """
                {
                    "ownerType": "CLUB",
                    "ownerId": "%s",
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(UUID.randomUUID(), product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound());
    }

    @Test
    void createAgainstNonActiveProductReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT));

        String body = """
                {
                    "ownerType": "CLUB",
                    "ownerId": "%s",
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(club.getId(), product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());

        assertThat(subscriptionRepository.findAll()).isEmpty();
    }

    @Test
    void createSecondActiveSubscriptionForSameClubReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        subscriptionRepository.save(newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        String body = """
                {
                    "ownerType": "CLUB",
                    "ownerId": "%s",
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(club.getId(), product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());

        assertThat(subscriptionRepository.findAll()).hasSize(1);
    }

    @Test
    void listWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/platform/subscriptions")).andExpect(status().isUnauthorized());
    }

    @Test
    void listWithNonPlatformAdminJwtReturns403() throws Exception {
        mockMvc.perform(get("/api/v1/platform/subscriptions")
                        .with(withRole("someone_else", UnaryOperator.identity())))
                .andExpect(status().isForbidden());
    }

    @Test
    void createWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownerType\": \"CLUB\", \"ownerId\": \"" + UUID.randomUUID()
                                + "\", \"productId\": \"" + UUID.randomUUID() + "\", \"responsiblePerson\": "
                                + VALID_RESPONSIBLE_PERSON_JSON + "}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createWithNonPlatformAdminJwtReturns403() throws Exception {
        mockMvc.perform(post("/api/v1/platform/subscriptions")
                        .with(withRole("someone_else", UnaryOperator.identity()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ownerType\": \"CLUB\", \"ownerId\": \"" + UUID.randomUUID()
                                + "\", \"productId\": \"" + UUID.randomUUID() + "\", \"responsiblePerson\": "
                                + VALID_RESPONSIBLE_PERSON_JSON + "}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void listReturnsPaginatedResultsDefaultSortedByStartDateDescending() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Subscription older = newSubscription(club.getId(), product.getId(), SubscriptionStatus.CANCELLED);
        older.setStartDate(LocalDate.of(2025, 1, 1));
        subscriptionRepository.save(older);
        Subscription newer = newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE);
        newer.setStartDate(LocalDate.of(2026, 1, 1));
        subscriptionRepository.save(newer);

        mockMvc.perform(get("/api/v1/platform/subscriptions").with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].startDate").value("2026-01-01"))
                .andExpect(jsonPath("$.content[1].startDate").value("2025-01-01"))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void getByIdReturnsTheSubscription() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Subscription subscription =
                subscriptionRepository.save(newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        mockMvc.perform(get("/api/v1/platform/subscriptions/{id}", subscription.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(subscription.getId().toString()))
                .andExpect(jsonPath("$.club.name").value("Riverside CC"));
    }

    @Test
    void getMissingSubscriptionReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/platform/subscriptions/{id}", UUID.randomUUID()).with(platformAdmin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateChangesProductAndPersistsWithoutCreatingANewRow() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product original = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Product upgraded = productRepository.save(newProduct("CLUB_PRO", ProductStatus.ACTIVE));
        Subscription subscription = subscriptionRepository.save(
                newSubscription(club.getId(), original.getId(), SubscriptionStatus.ACTIVE));

        String body = """
                {
                    "productId": "%s"
                }
                """.formatted(upgraded.getId());

        mockMvc.perform(put("/api/v1/platform/subscriptions/{id}", subscription.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.product.code").value("CLUB_PRO"));

        assertThat(subscriptionRepository.findAll()).hasSize(1);
        Subscription reloaded = subscriptionRepository.findById(subscription.getId()).orElseThrow();
        assertThat(reloaded.getProductId()).isEqualTo(upgraded.getId());
    }

    @Test
    void updateSilentlyIgnoresAnIllegallyIncludedResponsiblePersonField() throws Exception {
        // UpdateSubscriptionRequest has no responsiblePerson field at all — per
        // docs/specs/014-subscription-responsible-contact.md, who's responsible cannot be changed
        // through PUT. Jackson's default behavior (FAIL_ON_UNKNOWN_PROPERTIES isn't enabled here)
        // silently drops an unmapped property rather than rejecting the request.
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Subscription subscription = subscriptionRepository.save(
                newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));
        UUID originalResponsiblePersonId = subscription.getResponsiblePersonId();

        String body = """
                {
                    "productId": "%s",
                    "responsiblePerson": %s
                }
                """.formatted(product.getId(), VALID_RESPONSIBLE_PERSON_JSON);

        mockMvc.perform(put("/api/v1/platform/subscriptions/{id}", subscription.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responsiblePerson.id").value(originalResponsiblePersonId.toString()));

        Subscription reloaded = subscriptionRepository.findById(subscription.getId()).orElseThrow();
        assertThat(reloaded.getResponsiblePersonId()).isEqualTo(originalResponsiblePersonId);
    }

    @Test
    void updateAgainstNonActiveProductReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product original = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Product retired = productRepository.save(newProduct("CLUB_LEGACY", ProductStatus.RETIRED));
        Subscription subscription = subscriptionRepository.save(
                newSubscription(club.getId(), original.getId(), SubscriptionStatus.ACTIVE));

        String body = """
                {
                    "productId": "%s"
                }
                """.formatted(retired.getId());

        mockMvc.perform(put("/api/v1/platform/subscriptions/{id}", subscription.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());

        Subscription reloaded = subscriptionRepository.findById(subscription.getId()).orElseThrow();
        assertThat(reloaded.getProductId()).isEqualTo(original.getId());
    }

    @Test
    void cancelActiveSubscriptionTransitionsToCancelledAndKeepsItFetchable() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Subscription subscription = subscriptionRepository.save(
                newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        mockMvc.perform(post("/api/v1/platform/subscriptions/{id}/cancel", subscription.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(get("/api/v1/platform/subscriptions/{id}", subscription.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void cancelOnAlreadyCancelledSubscriptionReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Subscription subscription = subscriptionRepository.save(
                newSubscription(club.getId(), product.getId(), SubscriptionStatus.CANCELLED));

        mockMvc.perform(post("/api/v1/platform/subscriptions/{id}/cancel", subscription.getId())
                        .with(platformAdmin()))
                .andExpect(status().isConflict());
    }

    @Test
    void noDeleteEndpointExistsForSubscriptions() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE));
        Subscription subscription = subscriptionRepository.save(
                newSubscription(club.getId(), product.getId(), SubscriptionStatus.ACTIVE));

        mockMvc.perform(delete("/api/v1/platform/subscriptions/{id}", subscription.getId())
                        .with(platformAdmin()))
                .andExpect(status().isMethodNotAllowed());
    }

    private Club newClub(String name, String slug) {
        Club club = new Club();
        club.setName(name);
        club.setSlug(slug);
        club.setStatus(ClubStatus.ACTIVE);
        return club;
    }

    private Product newProduct(String code, ProductStatus status) {
        Product product = new Product();
        product.setCode(code);
        product.setName(code);
        product.setFree(true);
        product.setBillingInterval(BillingInterval.MONTHLY);
        product.setStatus(status);
        product.setDisplayOrder(0);
        return product;
    }

    private Subscription newSubscription(UUID ownerId, UUID productId, SubscriptionStatus status) {
        // responsible_person_id is NOT NULL (and FK-constrained) since
        // 009-subscription-responsible-person.sql — every Subscription needs a real, persisted
        // Person to point at, per docs/specs/014-subscription-responsible-contact.md.
        Person person = personRepository.save(Person.builder()
                .firstName("Jane")
                .lastName("Doe")
                .email("jane.doe+" + UUID.randomUUID() + "@example.com")
                .phone("+27821234567")
                .build());

        Subscription subscription = new Subscription();
        subscription.setOwnerType(SubscriptionOwnerType.CLUB);
        subscription.setOwnerId(ownerId);
        subscription.setProductId(productId);
        subscription.setStatus(status);
        subscription.setResponsiblePersonId(person.getId());
        return subscription;
    }
}
