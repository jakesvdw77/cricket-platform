package com.cricketlegend.config;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

/**
 * Per-request memory of what each caller may do in each club, per docs/specs/150-managers-and-access-grants.md: a list
 * endpoint asks several permission questions in one request, and each must not cost its own set of queries. Lives for
 * one HTTP request only, so a grant given or removed is seen by the very next request. Outside a web request (a test, a
 * job) the scope is not active and {@link AccessService} simply computes without it.
 */
@Component
@RequestScope
public class CallerGrants {

    private final Map<String, Map<UUID, EffectivePermissions>> byCaller = new HashMap<>();

    Map<UUID, EffectivePermissions> forCaller(String callerName) {
        return byCaller.computeIfAbsent(callerName, key -> new HashMap<>());
    }
}
