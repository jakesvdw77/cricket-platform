package com.cricketlegend.service.support.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.NameAliases;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.CandidateSource;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.ConfidenceBand;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.RememberedAlias;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.TeamCandidate;
import com.cricketlegend.service.support.schedule.TeamNameMatcher.TeamProposal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** docs/specs/098, "Team resolution": deterministic ranked proposals, nothing guessed, nothing linked silently. */
class TeamNameMatcherTest {

    private final TeamNameMatcher matcher = new TeamNameMatcher();

    private static TeamCandidate league(String name) {
        return new TeamCandidate(CandidateSource.LEAGUE_THIS_SEASON, "LEAGUE_TEAM", UUID.randomUUID(), name, null,
                null, null, true, false);
    }

    private static TeamCandidate of(CandidateSource source, String name) {
        return new TeamCandidate(source, "LEAGUE_TEAM", UUID.randomUUID(), name, null, null, null, true, false);
    }

    private static TeamCandidate own(String name) {
        return new TeamCandidate(CandidateSource.OWN_AFFILIATED, "OWN_TEAM", UUID.randomUUID(), name, null, null,
                null, true, false);
    }

    private TeamProposal only(String sheet, TeamCandidate... candidates) {
        List<TeamProposal> proposals = matcher.propose(sheet, List.of(candidates), List.of());
        assertThat(proposals).hasSize(1);
        return proposals.get(0);
    }

    @Test
    void exactAfterCaseAndPunctuationIsHundredAndPreselected() {
        TeamProposal p = only("BRITS  VETS-1", league("Brits Vets 1"));
        assertThat(p.confidence()).isEqualTo(100);
        assertThat(p.band()).isEqualTo(ConfidenceBand.EXACT);
        assertThat(p.preselected()).isTrue();
        assertThat(p.linkable()).isTrue();
        assertThat(p.reasons()).containsExactly("same name");
    }

    @Test
    void synonymVeteransAndVetsScoreNinetyFiveWithAReason() {
        TeamProposal p = only("BRITS VETERANS 1", league("Brits Vets 1"));
        assertThat(p.confidence()).isEqualTo(95);
        assertThat(p.band()).isEqualTo(ConfidenceBand.HIGH);
        assertThat(p.reasons()).containsExactly("VETERANS = VETS");
        assertThat(p.preselected()).isFalse();
    }

    @Test
    void abbreviationsExpand() {
        assertThat(only("Pretoria CC", league("Pretoria Cricket Club")).confidence()).isEqualTo(95);
        assertThat(only("Laudium UTD", league("Laudium United")).confidence()).isEqualTo(95);
    }

    @Test
    void sameLettersDifferentSpacingIsNinetyFour() {
        TeamProposal p = only("Sino ville 1", league("Sinoville 1"));
        assertThat(p.confidence()).isEqualTo(94);
        assertThat(p.reasons()).containsExactly("same letters, different spacing");
    }

    @Test
    void acronymPhsobMatchesTheFullName() {
        TeamProposal p = only("PHSOB", league("Pretoria High School Old Boys"));
        assertThat(p.confidence()).isEqualTo(92);
        assertThat(p.reasons()).containsExactly("PHSOB = initials of Pretoria High School Old Boys");
        assertThat(p.preselected()).isFalse();
    }

    /** Spec 098 rule 3: a sheet token of 3 to 8 capital letters matches the initials, also inside a longer name. */
    @Test
    void anAcronymTokenInsideAMultiWordNameMatchesTheFullName() {
        TeamProposal p = only("PHSOB VETERANS 1", league("Pretoria High School Old Boys Veterans 1"));
        assertThat(p.confidence()).isEqualTo(92);
        assertThat(p.preselected()).isFalse();
    }

    @Test
    void anAcronymTokenInsideAMultiWordNameNeedsTheRestOfTheNameToAgree() {
        TeamCandidate full = league("Pretoria High School Old Boys Veterans 1");
        assertThat(matcher.propose("PHSOB MASTERS 1", List.of(full), List.of())).isEmpty();
        assertThat(matcher.propose("ABCDE VETERANS 1", List.of(full), List.of())).isEmpty();
        assertThat(matcher.propose("phsob veterans 1", List.of(full), List.of())).isEmpty();
        // a different team number is still only a sister hint
        TeamProposal sister = only("PHSOB VETERANS 2", full);
        assertThat(sister.linkable()).isFalse();
    }

    @Test
    void acronymCbcobMatchesTheFullName() {
        TeamProposal p = only("CBCOB", league("Christian Brothers College Old Boys"));
        assertThat(p.confidence()).isEqualTo(92);
        assertThat(p.reasons().get(0)).isEqualTo("CBCOB = initials of Christian Brothers College Old Boys");
    }

    @Test
    void anAcronymNeedsCapitalsAsWritten() {
        // lower case "phsob" is just a word, not initials
        assertThat(matcher.propose("phsob", List.of(league("Pretoria High School Old Boys")), List.of())).isEmpty();
    }

    @Test
    void differentTeamNumbersAreNeverLinkedOnlyAHint() {
        List<TeamProposal> proposals = matcher.propose("POLICE 1", List.of(league("Police 2")), List.of());
        assertThat(proposals).hasSize(1);
        TeamProposal sister = proposals.get(0);
        assertThat(sister.linkable()).isFalse();
        assertThat(sister.preselected()).isFalse();
        assertThat(sister.confidence()).isZero();
        assertThat(sister.reasons().get(0)).contains("sister team");
    }

    @Test
    void sisterHintsComeAfterLinkableProposalsAndAreCapped() {
        List<TeamCandidate> candidates = List.of(league("Police 1"), league("Police 2"), league("Police 3"),
                league("Police 4"), league("Police 5"));
        List<TeamProposal> proposals = matcher.propose("Police 1", candidates, List.of());
        assertThat(proposals.get(0).linkable()).isTrue();
        assertThat(proposals.stream().filter(p -> !p.linkable()).count()).isEqualTo(TeamNameMatcher.MAX_SISTERS);
        assertThat(proposals.subList(1, proposals.size())).allMatch(p -> !p.linkable());
    }

    @Test
    void ordinalAndLetterSuffixesAreSuffixesToo() {
        assertThat(TeamNameMatcher.suffixOf("Police 1st")).isEqualTo("1");
        assertThat(TeamNameMatcher.suffixOf("Police 01")).isEqualTo("1");
        assertThat(TeamNameMatcher.suffixOf("Police A")).isEqualTo("A");
        assertThat(TeamNameMatcher.suffixOf("Police")).isNull();
        assertThat(TeamNameMatcher.baseName("Police 2nd")).isEqualTo("POLICE");
        assertThat(TeamNameMatcher.sisterTeams("Police 1", "Police 2")).isTrue();
        assertThat(TeamNameMatcher.sisterTeams("Police 1", "Police 1st")).isFalse();
        assertThat(TeamNameMatcher.sisterTeams("Police 1", "Pretoria 2")).isFalse();
    }

    @Test
    void aMissingSuffixInTheSheetIsMediumWithTheReason() {
        TeamProposal p = only("PRETORIA", league("Pretoria 1"));
        assertThat(p.confidence()).isEqualTo(80);
        assertThat(p.band()).isEqualTo(ConfidenceBand.MEDIUM);
        assertThat(p.reasons()).contains("no team number in the sheet");
        assertThat(p.preselected()).isFalse();
    }

    @Test
    void aSuffixOnlyInTheSheetIsProposedLower() {
        TeamProposal p = only("PRETORIA 1", league("Pretoria"));
        assertThat(p.confidence()).isEqualTo(75);
        assertThat(p.reasons()).contains("the sheet has a team number the team does not have");
    }

    @Test
    void anOpenAgeSheetNameNeverMatchesAnAgeGroupTeam() {
        // "Irene Villagers 1" is the senior side; "Irene Villagers U15" is a different team.
        List<TeamProposal> proposals = matcher.propose("Irene Villagers 1",
                List.of(own("Irene Villagers U15")), List.of());
        assertThat(proposals).hasSize(1);
        TeamProposal hint = proposals.get(0);
        assertThat(hint.linkable()).isFalse();
        assertThat(hint.preselected()).isFalse();
        assertThat(hint.reasons().get(0)).contains("age-group");
        assertThat(TeamNameMatcher.similar("Irene Villagers 1", "Irene Villagers U15")).isFalse();
    }

    @Test
    void anOpenNameWithoutNumberAlsoNeverMatchesAnAgeGroupTeam() {
        List<TeamProposal> proposals = matcher.propose("Irene Villagers", List.of(own("Irene Villagers U15")), List.of());
        assertThat(proposals).allMatch(p -> !p.linkable());
    }

    @Test
    void differentAgeGroupsNeverMatch() {
        assertThat(matcher.propose("Irene Villagers U15", List.of(own("Irene Villagers U13")), List.of())).isEmpty();
        TeamProposal same = only("Irene Villagers U15", own("Irene Villagers U15"));
        assertThat(same.confidence()).isEqualTo(100);
    }

    @Test
    void oneLetterTypoIsEightyEightAndTwoLettersEightyFour() {
        TeamProposal one = only("Vilagers 1", league("Villagers 1"));
        assertThat(one.confidence()).isEqualTo(88);
        assertThat(one.reasons()).containsExactly("one letter different");
        TeamProposal two = only("Hofmeyxr Pxrk", league("Hofmeyer Park"));
        assertThat(two.confidence()).isEqualTo(84);
        assertThat(two.reasons()).containsExactly("two letters different");
    }

    @Test
    void veryShortNamesTolerateNoTypo() {
        assertThat(matcher.propose("Brit", List.of(league("Brat")), List.of())).isEmpty();
    }

    @Test
    void unrelatedNamesGiveNoProposal() {
        assertThat(matcher.propose("Laudium 1", List.of(league("Sinoville 1"), league("Brits Oval")), List.of()))
                .isEmpty();
    }

    @Test
    void sharedWordsScoreByTokenSimilarityBelowNinety() {
        TeamProposal p = only("Irene Country Club", league("Irene Country Club Veterans"));
        assertThat(p.confidence()).isBetween(45, 89);
        assertThat(p.preselected()).isFalse();
    }

    @Test
    void aRememberedAliasComesFirstAndIsPreselected() {
        TeamCandidate target = own("Villagers 1");
        TeamCandidate lookalike = league("Pol Villagers");
        RememberedAlias alias = new RememberedAlias(NameAliases.normalise("Pol"), target, "5 Oct 2026");
        List<TeamProposal> proposals = matcher.propose("Pol", List.of(lookalike, target), List.of(alias));
        TeamProposal first = proposals.get(0);
        assertThat(first.source()).isEqualTo(CandidateSource.ALIAS);
        assertThat(first.targetId()).isEqualTo(target.targetId());
        assertThat(first.confidence()).isEqualTo(100);
        assertThat(first.preselected()).isTrue();
        assertThat(first.reasons().get(0)).isEqualTo("remembered from an import on 5 Oct 2026");
        // the aliased target is not listed twice
        assertThat(proposals.stream().filter(p -> target.targetId().equals(p.targetId()))).hasSize(1);
    }

    @Test
    void anAliasToAnInactiveTeamIsNotPreselected() {
        TeamCandidate inactive = new TeamCandidate(CandidateSource.LEAGUE_THIS_SEASON, "LEAGUE_TEAM", UUID.randomUUID(),
                "Old Team", null, null, null, false, false);
        List<TeamProposal> proposals = matcher.propose("Pol", List.of(inactive),
                List.of(new RememberedAlias(NameAliases.normalise("Pol"), inactive, null)));
        assertThat(proposals.get(0).preselected()).isFalse();
    }

    @Test
    void equalConfidenceIsOrderedBySourceThenName() {
        TeamCandidate previous = of(CandidateSource.LEAGUE_PREVIOUS_SEASON, "Police 1");
        TeamCandidate thisSeason = of(CandidateSource.LEAGUE_THIS_SEASON, "Police 1");
        TeamCandidate ours = of(CandidateSource.OWN_AFFILIATED, "Police 1");
        List<TeamProposal> proposals = matcher.propose("Police 1", List.of(previous, thisSeason, ours), List.of());
        assertThat(proposals).extracting(TeamProposal::source).containsExactly(CandidateSource.OWN_AFFILIATED,
                CandidateSource.LEAGUE_THIS_SEASON, CandidateSource.LEAGUE_PREVIOUS_SEASON);
    }

    @Test
    void higherConfidenceOutranksABetterSource() {
        TeamCandidate typoThisSeason = of(CandidateSource.LEAGUE_THIS_SEASON, "Policee 1");
        TeamCandidate exactPrevious = of(CandidateSource.LEAGUE_PREVIOUS_SEASON, "Police 1");
        List<TeamProposal> proposals = matcher.propose("Police 1", List.of(typoThisSeason, exactPrevious), List.of());
        assertThat(proposals).extracting(TeamProposal::confidence).containsExactly(100, 88);
    }

    @Test
    void twoExactCandidatesInOneSourceArePreselectedNeitherWay() {
        List<TeamProposal> proposals = matcher.propose("Police 1",
                List.of(league("Police 1"), league("POLICE 1")), List.of());
        assertThat(proposals).hasSize(2).allMatch(p -> !p.preselected());
    }

    @Test
    void anInactiveExactCandidateIsNotPreselectedAndSaysSo() {
        TeamCandidate inactive = new TeamCandidate(CandidateSource.LEAGUE_THIS_SEASON, "LEAGUE_TEAM", UUID.randomUUID(),
                "Police 1", null, null, null, false, false);
        TeamProposal p = only("Police 1", inactive);
        assertThat(p.preselected()).isFalse();
        assertThat(p.reasons()).contains("inactive");
    }

    @Test
    void reasonsMentionPreviousSeasonAndEarlierImports() {
        TeamCandidate previous = new TeamCandidate(CandidateSource.LEAGUE_PREVIOUS_SEASON, "LEAGUE_TEAM",
                UUID.randomUUID(), "Police 1", null, "2025/26", "Premier", true, true);
        TeamProposal p = only("Police 1", previous);
        assertThat(p.reasons()).contains("created by an earlier import", "same team name last season");
        assertThat(p.seasonLabel()).isEqualTo("2025/26");
    }

    @Test
    void proposalsAreCappedAtTen() {
        List<TeamCandidate> many = new java.util.ArrayList<>();
        for (int i = 0; i < 15; i++) {
            many.add(league("Brits Vets Team " + (char) ('C' + i)));
        }
        List<TeamProposal> proposals = matcher.propose("Brits Vets Team", many, List.of());
        assertThat(proposals.stream().filter(TeamProposal::linkable).count()).isLessThanOrEqualTo(10);
    }

    @Test
    void proposeAllKeysByTheGivenText() {
        Map<String, List<TeamProposal>> all = matcher.proposeAll(List.of("POLICE 1", "Laudium 1"),
                List.of(league("Police 1"), league("Laudium 1")), List.of());
        assertThat(all.keySet()).containsExactly("POLICE 1", "Laudium 1");
        assertThat(all.get("POLICE 1").get(0).confidence()).isEqualTo(100);
        assertThat(all.get("Laudium 1").get(0).confidence()).isEqualTo(100);
    }

    @Test
    void tidyNameKeepsInitialsAndTitleCasesTheRest() {
        assertThat(TeamNameMatcher.tidyTeamName("IRENE VILLAGERS 1")).isEqualTo("Irene Villagers 1");
        assertThat(TeamNameMatcher.tidyTeamName("PHSOB VETERANS 1")).isEqualTo("PHSOB Veterans 1");
        assertThat(TeamNameMatcher.tidyTeamName("CBCOB veterans 2")).isEqualTo("CBCOB Veterans 2");
        assertThat(TeamNameMatcher.tidyTeamName("POLICE 1st XI")).isEqualTo("Police 1st XI");
        assertThat(TeamNameMatcher.tidyTeamName("  ")).isEmpty();
        assertThat(TeamNameMatcher.tidyTeamName(null)).isEmpty();
    }

    @Test
    void normaliseFoldsAccentsAmpersandAndPunctuation() {
        assertThat(TeamNameMatcher.normalise("Café  & Co.")).isEqualTo("CAFE AND CO");
        assertThat(TeamNameMatcher.normalise(null)).isEmpty();
    }
}
