package com.cricketlegend.service.support;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import java.util.List;
import java.util.Map;

/** The windows of some group rounds plus each (window, match) pair, loaded in one batched walk. */
public record RoundWindows(
        List<SectionAvailabilityWindow> windows, List<Map.Entry<SectionAvailabilityWindow, Match>> pairs) {}
