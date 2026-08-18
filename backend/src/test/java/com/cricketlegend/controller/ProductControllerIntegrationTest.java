package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.BillingInterval;
import com.cricketlegend.domain.Product;
import com.cricketlegend.domain.ProductStatus;
import com.cricketlegend.repository.ProductRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for ProductController — per docs/specs/008-product-catalog.md's Test
 * Plan and docs/plans/008-product-catalog.md's Test tier list: create/persist, validation, duplicate
 * code conflict, paginated list, get-by-id (found/missing), update (including the DRAFT-&gt;ACTIVE
 * transition), retire (including retiring an already-retired product), and platform_admin
 * enforcement on every route.
 *
 * <p>Uses {@code @Import(AbstractIntegrationTest.class)} rather than {@code extends}, matching
 * {@code LeadControllerIntegrationTest}'s convention.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class ProductControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository productRepository;

    @Test
    void createValidProductPersistsAsDraftWithStatus201() throws Exception {
        String body = """
                {
                    "code": "CLUB_STANDARD",
                    "name": "Club Standard",
                    "description": "The standard tier.",
                    "isFree": false,
                    "price": 49.99,
                    "currency": "USD",
                    "billingInterval": "MONTHLY",
                    "maxSections": 5,
                    "maxTeams": 10,
                    "maxPlayers": 200
                }
                """;

        mockMvc.perform(post("/api/v1/platform/products")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.code").value("CLUB_STANDARD"))
                .andExpect(jsonPath("$.price").value(49.99))
                .andExpect(jsonPath("$.displayOrder").value(0));

        List<Product> products = productRepository.findAll();
        assertThat(products).hasSize(1);
        assertThat(products.get(0).getStatus()).isEqualTo(ProductStatus.DRAFT);
        assertThat(products.get(0).getDisplayOrder()).isZero();
    }

    @Test
    void createWithBlankNameReturns400() throws Exception {
        String body = """
                {
                    "code": "CLUB_STANDARD",
                    "name": "",
                    "isFree": true
                }
                """;

        mockMvc.perform(post("/api/v1/platform/products")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        assertThat(productRepository.findAll()).isEmpty();
    }

    @Test
    void createWithIsFreeFalseAndMissingPriceReturns400() throws Exception {
        String body = """
                {
                    "code": "CLUB_STANDARD",
                    "name": "Club Standard",
                    "isFree": false,
                    "currency": "USD"
                }
                """;

        mockMvc.perform(post("/api/v1/platform/products")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        assertThat(productRepository.findAll()).isEmpty();
    }

    @Test
    void createWithDuplicateCodeCaseInsensitiveReturns409() throws Exception {
        productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT, 0));

        String body = """
                {
                    "code": "club_standard",
                    "name": "Another Standard",
                    "isFree": true
                }
                """;

        mockMvc.perform(post("/api/v1/platform/products")
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());

        assertThat(productRepository.findAll()).hasSize(1);
    }

    @Test
    void listWithoutAuthenticationReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/platform/products")).andExpect(status().isUnauthorized());
    }

    @Test
    void listReturnsPaginatedResultsOrderedByDisplayOrder() throws Exception {
        productRepository.save(newProduct("THIRD", ProductStatus.DRAFT, 3));
        productRepository.save(newProduct("FIRST", ProductStatus.DRAFT, 1));
        productRepository.save(newProduct("SECOND", ProductStatus.DRAFT, 2));

        mockMvc.perform(get("/api/v1/platform/products").with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(3)))
                .andExpect(jsonPath("$.content[0].code").value("FIRST"))
                .andExpect(jsonPath("$.content[1].code").value("SECOND"))
                .andExpect(jsonPath("$.content[2].code").value("THIRD"))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(1));

        mockMvc.perform(get("/api/v1/platform/products")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void getByIdReturnsTheProduct() throws Exception {
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT, 0));

        mockMvc.perform(get("/api/v1/platform/products/{id}", product.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("CLUB_STANDARD"));
    }

    @Test
    void getMissingProductReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/platform/products/{id}", UUID.randomUUID()).with(platformAdmin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateTransitionsDraftToActiveAndPersistsEditedFields() throws Exception {
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT, 0));

        String body = """
                {
                    "code": "CLUB_STANDARD",
                    "name": "Club Standard (renamed)",
                    "isFree": false,
                    "price": 59.99,
                    "currency": "USD",
                    "billingInterval": "ANNUAL",
                    "displayOrder": 1,
                    "status": "ACTIVE",
                    "showAds": false,
                    "allowSubdomain": false,
                    "allowWhitelisting": false
                }
                """;

        mockMvc.perform(put("/api/v1/platform/products/{id}", product.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.name").value("Club Standard (renamed)"))
                .andExpect(jsonPath("$.price").value(59.99));

        Product reloaded = productRepository.findById(product.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ProductStatus.ACTIVE);
        assertThat(reloaded.getDisplayOrder()).isEqualTo(1);
    }

    @Test
    void updateTransitioningToRetiredReturns409() throws Exception {
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT, 0));

        String body = """
                {
                    "code": "CLUB_STANDARD",
                    "name": "Club Standard",
                    "isFree": true,
                    "displayOrder": 0,
                    "status": "RETIRED",
                    "showAds": false,
                    "allowSubdomain": false,
                    "allowWhitelisting": false
                }
                """;

        mockMvc.perform(put("/api/v1/platform/products/{id}", product.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());

        Product reloaded = productRepository.findById(product.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ProductStatus.DRAFT);
    }

    @Test
    void retireTransitionsToRetiredAndKeepsTheRowFetchable() throws Exception {
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.ACTIVE, 0));

        mockMvc.perform(post("/api/v1/platform/products/{id}/retire", product.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETIRED"));

        mockMvc.perform(get("/api/v1/platform/products/{id}", product.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETIRED"));
    }

    @Test
    void retireOnAlreadyRetiredProductReturns409() throws Exception {
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.RETIRED, 0));

        mockMvc.perform(post("/api/v1/platform/products/{id}/retire", product.getId()).with(platformAdmin()))
                .andExpect(status().isConflict());
    }

    @Test
    void createUpdateAndRetireWithoutAuthenticationAllReturn401() throws Exception {
        Product product = productRepository.save(newProduct("CLUB_STANDARD", ProductStatus.DRAFT, 0));

        mockMvc.perform(post("/api/v1/platform/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\": \"X\", \"name\": \"X\", \"isFree\": true}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/platform/products/{id}", product.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/v1/platform/products/{id}", product.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\": \"X\", \"name\": \"X\", \"isFree\": true, \"displayOrder\": 0, \"status\": \"DRAFT\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/platform/products/{id}/retire", product.getId()))
                .andExpect(status().isUnauthorized());
    }

    private Product newProduct(String code, ProductStatus status, int displayOrder) {
        Product product = new Product();
        product.setCode(code);
        product.setName(code);
        product.setFree(true);
        product.setBillingInterval(BillingInterval.MONTHLY);
        product.setStatus(status);
        product.setDisplayOrder(displayOrder);
        return product;
    }
}
