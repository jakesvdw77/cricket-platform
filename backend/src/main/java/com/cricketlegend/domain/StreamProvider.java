package com.cricketlegend.domain;

/** docs/specs/135: the allow-listed video providers the Player Hub can embed; anything else is OTHER (a plain link). */
public enum StreamProvider {
    YOUTUBE,
    VIMEO,
    FACEBOOK,
    OTHER
}
