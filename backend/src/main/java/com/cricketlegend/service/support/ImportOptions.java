package com.cricketlegend.service.support;

import java.time.ZoneId;

/** What a handler needs to read a file: the IANA zone local times are read in (docs/specs/097, R11). */
public record ImportOptions(ZoneId zone) {
}
