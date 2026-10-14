package com.cricketlegend.domain;

/** docs/specs/101: how a validation issue is treated. Errors block publish, warnings are acknowledged, info is shown only. */
public enum ResultIssueSeverity {
    ERROR,
    WARNING,
    INFO
}
