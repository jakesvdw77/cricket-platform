package com.cricketlegend.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A club's sponsor (name, website, email, phone, logo, banner, social links) — many-to-one with
 * {@link Club}, matching {@link ClubContact}'s existing convention of a plain {@code UUID} FK
 * column with no JPA relationship navigation. "Disable, never delete" — see {@link #active}.
 * {@code socialLinks} reuses the {@link SocialLink} {@code @Embeddable}/{@code @ElementCollection}
 * pattern established by {@link ClubProfile#getSocialLinks()} in
 * docs/specs/022-club-social-media.md, with its own owning table ({@code sponsor_social_link}).
 * See docs/specs/023-sponsors.md.
 *
 * <p>Naming a sponsor's own contact *people* (as opposed to this organisation-level {@code
 * email}/{@code phone}) is deliberately out of scope here — see docs/specs/024 (not yet built).
 */
@Entity
@Table(name = "sponsor")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sponsor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "club_id", nullable = false)
    private UUID clubId;

    @Column(nullable = false)
    private String name;

    private String website;

    private String email;

    private String phone;

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(name = "banner_url")
    private String bannerUrl;

    @ElementCollection
    @CollectionTable(name = "sponsor_social_link", joinColumns = @JoinColumn(name = "sponsor_id"))
    @Builder.Default
    private List<SocialLink> socialLinks = new ArrayList<>();

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
