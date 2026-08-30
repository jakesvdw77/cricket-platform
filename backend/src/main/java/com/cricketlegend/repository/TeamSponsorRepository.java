package com.cricketlegend.repository;

import com.cricketlegend.domain.TeamSponsor;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Every currently-linked {@link com.cricketlegend.domain.Sponsor} for a {@link
 * com.cricketlegend.domain.Team}, and the reverse-direction lookups the link/unlink business
 * rules need — same method shape as {@code SectionContactRepository}. See
 * docs/specs/027-team-profile.md.
 */
public interface TeamSponsorRepository extends JpaRepository<TeamSponsor, UUID> {

    List<TeamSponsor> findByTeamId(UUID teamId);

    boolean existsByTeamIdAndSponsorId(UUID teamId, UUID sponsorId);

    Optional<TeamSponsor> findByTeamIdAndSponsorId(UUID teamId, UUID sponsorId);

    void deleteByTeamIdAndSponsorId(UUID teamId, UUID sponsorId);
}
