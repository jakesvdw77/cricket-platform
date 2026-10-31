package com.cricketlegend.domain;

/** Where a batch's rows came from; AI_TRANSFORM is reserved for the unbuilt phase 2 (spec 097); MANUAL is a batch started with no file (spec 125). */
public enum ImportSource {
    TEMPLATE_FILE, AI_TRANSFORM, MANUAL
}
