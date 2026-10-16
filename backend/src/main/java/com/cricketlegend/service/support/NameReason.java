package com.cricketlegend.service.support;

/** Why a written name got its {@link NameLevel}: the rule that placed it, or the reason it was not placed. */
public enum NameReason {
    /** Tier 1: equal after trimming. */
    EXACT,
    /** A remembered per-club alias (set by the processor, which owns the alias lookup; the matcher never produces it). */
    ALIAS,
    /** Level EXACT: same words and order, differing only in case, accents, spacing or surname particle form (vd, van der). */
    NORMALISED_EXACT,
    /** Tier 2: equal after the shared normalisation, in either word order. */
    NORMALISED,
    /** Tier 3a: the surname equals the candidate's and the given names or initials agree. */
    INITIALS,
    /** Tier 3: given name plus one or two surname initials ("Sol V" for "Sol Varga"). */
    SURNAME_INITIAL,
    /** Tier 3b: an abbreviated particle surname such as "vdW" for "van der Walt". */
    ABBREVIATED_SURNAME,
    /** Tier 3c: a surname of three or more characters that is a prefix of the candidate's surname. */
    SURNAME_PREFIX,
    /** Two or more candidates satisfied the same rule, so nothing was linked. */
    AMBIGUOUS,
    /** Nothing in tiers 1 to 3 identified a candidate. */
    NO_MATCH,
    /** Another, differently written row of the same list already took this candidate (one person per row). */
    COLLISION
}
