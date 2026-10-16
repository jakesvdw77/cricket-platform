package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** docs/specs/104: the word-level helpers every name tier shares. Invented names only. */
class NameTokensTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', textBlock = """
            Abel Nazar        | Abel,Nazar
            A.B. Nazar        | A,B,Nazar
            Nazar, A          | Nazar,A
              Abel   Nazar    | Abel,Nazar
            Nazar (Capt)      | Nazar,Capt
            Zoë Ngwenya       | Zoë,Ngwenya
            """)
    void splitsOnSpacesDotsCommasAndBrackets(String name, String words) {
        assertThat(NameTokens.of(name).words()).containsExactly(words.split(","));
    }

    @Test
    void nullBlankAndPunctuationOnlyAreEmpty() {
        assertThat(NameTokens.of(null).isEmpty()).isTrue();
        assertThat(NameTokens.of("   ").isEmpty()).isTrue();
        assertThat(NameTokens.of(". , ;").isEmpty()).isTrue();
        assertThat(NameTokens.of("Abel Nazar").joined()).isEqualTo("Abel Nazar");
    }

    @ParameterizedTest
    @CsvSource({"van,true", "Van,true", "der,true", "den,true", "ten,true", "ter,true", "vd,true", "de,true", "du,true",
            "le,true", "Nazar,false", "A,false", "Abel,false", "'',false"})
    void recognisesSurnameParticles(String word, boolean particle) {
        assertThat(NameTokens.isParticle(word)).isEqualTo(particle);
    }

    @Test
    void aSingleWordReadsOneWayAndTwoWordsReadBothWays() {
        assertThat(NameTokens.of("Nazar").splits()).singleElement()
                .satisfies(s -> assertThat(s.surname()).containsExactly("Nazar"));
        List<NameTokens.Split> two = NameTokens.of("A Nazar").splits();

        assertThat(two).hasSize(2);
        assertThat(two.get(0).given()).containsExactly("A");
        assertThat(two.get(0).surname()).containsExactly("Nazar");
        assertThat(two.get(1).given()).containsExactly("Nazar");
        assertThat(two.get(1).surname()).containsExactly("A");
    }

    @Test
    void theSurnameTakesItsLeadingParticleWordsInEitherOrder() {
        NameTokens.Split last = NameTokens.of("Sam van der Walt").splits().get(0);
        NameTokens.Split first = NameTokens.of("van der Walt S").splits().get(0);

        assertThat(last.given()).containsExactly("Sam");
        assertThat(last.surname()).containsExactly("van", "der", "Walt");
        // read surname-first, the leading particles plus the next word are the surname
        assertThat(NameTokens.of("van der Walt S").splits()).anySatisfy(s -> {
            assertThat(s.given()).containsExactly("S");
            assertThat(s.surname()).containsExactly("van", "der", "Walt");
        });
        assertThat(first).isNotNull();
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', nullValues = "NONE", textBlock = """
            van der Walt    | vdw
            VanDerWalt      | vdw
            Van Der Nell    | vdn
            vd Walton   | vdw
            De Vries     | dv
            de Vries     | dv
            Walt            | ''
            Nazar           | ''
            """)
    void abbreviatesAParticleSurnameTheWayReportsDo(String surname, String abbreviation) {
        assertThat(NameTokens.abbreviatedSurname(surname)).isEqualTo(abbreviation);
    }
}
