package com.cricketlegend.service.adaptor;

import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.exception.ImportInputValidationException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md: the adaptor for a CricClubs scorecard export, uploaded as a CSV
 * file or pasted. The export is a text report, not a table, so the work is in {@link CricClubsReportParser} and its
 * line reader; no library and no AI. Every line is understood or reported with its line number, and nothing is guessed.
 *
 * <p>Decoding differs from the base class: UTF-8 first (a byte order mark tolerated), and a file that is not valid UTF-8
 * is read as Windows-1252, because a real export from a Windows machine is, and must not be refused for its encoding.
 */
@Component
public class CricClubsCsvAdaptor extends AbstractAdaptor {

    private static final long serialVersionUID = 1L;
    private static final Charset WINDOWS_1252 = Charset.forName("windows-1252");

    private static final String EXAMPLE = """
            T20:  LeagueNorth Oval 1 won by 12 Runs (11/10/2026)
                                 North Oval 1 Vs Harbour Town 2
            ,,,North Oval 1 Batting

            \tBatsMan, How Out, Fielder, Bowler, Runs, Balls, Fours,Sixers
            \tAnna Example,b,,Carl Sample,34,28,4,1
            Ben Placeholder,,,,10,8,1,0
            Dee Spare,,,,0,0,0,0

            \t\tByes: 0 , Leg Byes: 1, Wickets : 1  Wides : 2, No Balls: 0 Penalty : 0,120,20

            ,,,Harbour Town 2 Bowling

            \tBowler,Overs,Madiens,Runs,Wickets,Wides,No Balls,Hattricks,Dot Balls
            \tCarl Sample,4,0,24,1,2,0,0,10
            Total, 4 ,0,24,1,2,0,0,10
            """;

    public CricClubsCsvAdaptor() {
        super(AdaptorType.CRICCLUBS_CSV);
    }

    @Override
    public String getDisplayName() {
        return "CricClubs scorecard (CSV)";
    }

    @Override
    public String getDescription() {
        return "A match result exported from CricClubs as a CSV file, uploaded or pasted.";
    }

    @Override
    public Set<ImportInputFormat> getSupportedFormats() {
        return Set.of(ImportInputFormat.CSV);
    }

    @Override
    public String getExample() {
        return EXAMPLE;
    }

    /** UTF-8 first (a byte order mark is tolerated); bytes that are not valid UTF-8 are read as Windows-1252. */
    @Override
    public AdaptorContent read(ImportInput input) {
        if (!input.format().isTextBased()) {
            return super.read(input);
        }
        return new TextContent(decode(input.bytes()));
    }

    @Override
    public void validate(AdaptorContent content) {
        parse(content);
    }

    @Override
    public ImportedResultDto transform(AdaptorContent content, AdaptorContext context) {
        return parse(content);
    }

    private static ImportedResultDto parse(AdaptorContent content) {
        String text = ((TextContent) content).text();
        if (text == null || text.isBlank()) {
            throw new ImportInputValidationException(
                    "The file is not a CricClubs scorecard this adaptor can read.",
                    List.of(new ImportErrorDto("", "EMPTY_FILE", "The file is empty.")));
        }
        return CricClubsReportParser.parse(text);
    }

    private static String decode(byte[] bytes) {
        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException ex) {
            text = new String(bytes, WINDOWS_1252);
            // a UTF-8 byte order mark in a file that is otherwise not UTF-8 decodes here as three Windows-1252 characters
            if (text.startsWith("\u00EF\u00BB\u00BF")) {
                return text.substring(3);
            }
        }
        return text.startsWith("\uFEFF") ? text.substring(1) : text;
    }
}
