package com.cricketlegend.repository;

import com.cricketlegend.domain.TeamContact;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Every currently-linked {@link com.cricketlegend.domain.ClubContact} for a {@link
 * com.cricketlegend.domain.Team}, and the reverse-direction lookups the link/unlink business
 * rules need — same method shape as {@code SectionContactRepository}. See
 * docs/specs/027-team-profile.md.
 */
public interface TeamContactRepository extends JpaRepository<TeamContact, UUID> {

    List<TeamContact> findByTeamId(UUID teamId);

    boolean existsByTeamIdAndClubContactId(UUID teamId, UUID clubContactId);

    Optional<TeamContact> findByTeamIdAndClubContactId(UUID teamId, UUID clubContactId);

    void deleteByTeamIdAndClubContactId(UUID teamId, UUID clubContactId);
}
