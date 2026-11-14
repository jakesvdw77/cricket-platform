package com.cricketlegend.repository;

import com.cricketlegend.domain.AccessRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessRoleRepository extends JpaRepository<AccessRole, UUID> {

    /** The built-in, global roles (club_id is null), per docs/specs/150-managers-and-access-grants.md. */
    List<AccessRole> findByClubIdIsNull();

    Optional<AccessRole> findByKeyAndClubIdIsNull(String key);
}
