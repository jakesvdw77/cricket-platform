package com.cricketlegend.service.impl;

import com.cricketlegend.domain.AccessRole;
import com.cricketlegend.domain.Permission;
import com.cricketlegend.dto.AccessRoleDto;
import com.cricketlegend.dto.AccessRolePermissionDto;
import com.cricketlegend.repository.AccessRoleRepository;
import com.cricketlegend.service.AccessRoleService;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccessRoleServiceImpl implements AccessRoleService {

    // Fixed display order of the built-in roles, most powerful first.
    private static final List<String> ORDER = List.of("MANAGER", "COORDINATOR", "TEAM_MANAGER", "SCORER", "VIEWER");

    private final AccessRoleRepository accessRoleRepository;
    private final Set<String> assignableKeys;

    public AccessRoleServiceImpl(
            AccessRoleRepository accessRoleRepository,
            @Value("${app.access.assignable-roles:MANAGER}") List<String> assignableKeys) {
        this.accessRoleRepository = accessRoleRepository;
        this.assignableKeys = Set.copyOf(assignableKeys);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AccessRoleDto> list() {
        return accessRoleRepository.findByClubIdIsNull().stream()
                .sorted(Comparator.comparingInt(role -> orderOf(role.getKey())))
                .map(this::toDto)
                .toList();
    }

    @Override
    public boolean isAssignable(AccessRole role) {
        return assignableKeys.contains(role.getKey());
    }

    private AccessRoleDto toDto(AccessRole role) {
        List<AccessRolePermissionDto> permissions = role.permissions().stream()
                .sorted()
                .map(AccessRoleServiceImpl::toPermissionDto)
                .toList();
        return new AccessRoleDto(
                role.getId(), role.getKey(), role.getName(), role.getDescription(), isAssignable(role), permissions);
    }

    private static AccessRolePermissionDto toPermissionDto(Permission permission) {
        return new AccessRolePermissionDto(
                permission.name(), permission.label(), permission.level().name(), permission.reach().name());
    }

    private static int orderOf(String key) {
        int index = ORDER.indexOf(key);
        return index < 0 ? ORDER.size() : index;
    }
}
