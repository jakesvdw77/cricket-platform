package com.cricketlegend.service.support;

/** First character, three asterisks, the domain: {@code j***@gmail.com} (docs/specs/119, Decision 15). Pure. */
public final class MaskedEmail {

    private MaskedEmail() {}

    public static String mask(String email) {
        if (email == null) {
            return null;
        }
        int at = email.indexOf('@');
        if (at < 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
