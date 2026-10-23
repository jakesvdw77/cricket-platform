package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** docs/specs/119, Decision 15: first character, three asterisks, the domain. */
class MaskedEmailTest {

    @Test
    void keepsTheFirstCharacterAndTheDomainOnly() {
        assertThat(MaskedEmail.mask("jane.doe@gmail.com")).isEqualTo("j***@gmail.com");
        assertThat(MaskedEmail.mask("a@b.co")).isEqualTo("a***@b.co");
    }

    @Test
    void neverEchoesTheLocalPartBeyondTheFirstCharacter() {
        assertThat(MaskedEmail.mask("secretname@club.org")).doesNotContain("ecret");
    }

    @Test
    void aMissingOrMalformedAddressIsNullOrFullyMasked() {
        assertThat(MaskedEmail.mask(null)).isNull();
        assertThat(MaskedEmail.mask("no-at-sign")).isEqualTo("***");
        assertThat(MaskedEmail.mask("@nolocal.com")).isEqualTo("***");
    }
}
