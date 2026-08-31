package com.cricketlegend.repository;

import com.cricketlegend.domain.PlayerSection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Every currently-tagged {@link com.cricketlegend.domain.Section} for a {@link
 * com.cricketlegend.domain.PlayerProfile}, and the reverse-direction lookups the link/unlink
 * business rules need — same method shape as {@code TeamSponsorRepository}. See
 * docs/specs/028-players.md.
 */
public interface PlayerSectionRepository extends JpaRepository<PlayerSection, UUID> {

    List<PlayerSection> findByPlayerProfileId(UUID playerProfileId);

    boolean existsByPlayerProfileIdAndSectionId(UUID playerProfileId, UUID sectionId);

    Optional<PlayerSection> findByPlayerProfileIdAndSectionId(UUID playerProfileId, UUID sectionId);

    void deleteByPlayerProfileIdAndSectionId(UUID playerProfileId, UUID sectionId);
}
