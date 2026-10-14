package com.cricketlegend.domain;

/**
 * docs/specs/101: the result wizard step a validation issue is fixed on (the Review step's Fix link). The scorecard
 * steps carry the side in the issue's {@code side}: TEAMS (who played), BATTING, BOWLING (bowling and fielding), AWARDS.
 */
public enum ResultWizardStep {
    RESULT,
    TOSS,
    SCORES,
    TEAMS,
    BATTING,
    BOWLING,
    AWARDS
}
