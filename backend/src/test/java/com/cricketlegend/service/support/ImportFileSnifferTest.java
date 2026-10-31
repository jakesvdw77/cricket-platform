package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.exception.ImportFileRejectedException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

/** docs/specs/097, "Hardening": size, extension, magic bytes, macros and zip bombs are refused before POI opens a file. */
class ImportFileSnifferTest {

    private static byte[] zip(String... entries) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (String name : entries) {
                zip.putNextEntry(new ZipEntry(name));
                zip.write("<x/>".getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }

    @Test
    void aValidXlsxAndCsvAreAccepted() throws IOException {
        ImportFile xlsx = ImportFileSniffer.sniff("schedule.XLSX", zip("[Content_Types].xml", "xl/workbook.xml"));
        assertThat(xlsx.kind()).isEqualTo(ImportFileKind.XLSX);
        ImportFile csv = ImportFileSniffer.sniff("schedule.csv", "Date,Time\n2026-09-13,08:00\n".getBytes(StandardCharsets.UTF_8));
        assertThat(csv.kind()).isEqualTo(ImportFileKind.CSV);
        assertThat(csv.name()).isEqualTo("schedule.csv");
    }

    @Test
    void emptyAndOversizedAreRefused() {
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.csv", new byte[0])).isInstanceOf(ImportFileRejectedException.class)
                .hasMessageContaining("empty");
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.csv", null)).isInstanceOf(ImportFileRejectedException.class);
        byte[] big = new byte[(int) ImportLimits.MAX_FILE_BYTES + 1];
        java.util.Arrays.fill(big, (byte) 'a');
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.csv", big)).isInstanceOf(ImportFileRejectedException.class)
                .hasMessageContaining("2 MB");
    }

    @Test
    void legacyAndMacroExtensionsAreNamedAndRefused() {
        for (String name : new String[] {"a.xls", "a.xlsm", "a.xlsb"}) {
            assertThatThrownBy(() -> ImportFileSniffer.sniff(name, new byte[] {1, 2, 3, 4, 5}))
                    .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("Save your file as .xlsx");
        }
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.pdf", new byte[] {1}))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("Only .xlsx and .csv");
        assertThatThrownBy(() -> ImportFileSniffer.sniff(null, new byte[] {1}))
                .isInstanceOf(ImportFileRejectedException.class);
    }

    @Test
    void anXlsxNameWithoutZipMagicBytesIsRefused() {
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.xlsx", "Date,Time".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("not a valid .xlsx");
    }

    @Test
    void aZipWithoutAWorkbookIsRefused() throws IOException {
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.xlsx", zip("something.xml")))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("not an Excel workbook");
    }

    @Test
    void aMacroMarkerInsideAnXlsxIsRefused() throws IOException {
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.xlsx", zip("xl/workbook.xml", "xl/vbaProject.bin")))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("macros");
    }

    @Test
    void aZipBombIsRefusedByEntryCountAndByUncompressedSize() throws IOException {
        String[] many = new String[2_001];
        for (int i = 0; i < many.length; i++) {
            many[i] = "f" + i;
        }
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.xlsx", zip(many)))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("cannot be read safely");

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("xl/workbook.xml"));
            byte[] chunk = new byte[1024 * 1024];
            for (int i = 0; i < 51; i++) {
                zip.write(chunk);
            }
            zip.closeEntry();
        }
        byte[] bomb = out.toByteArray();
        assertThat(bomb.length).as("compresses far below the 2 MB limit").isLessThan((int) ImportLimits.MAX_FILE_BYTES);
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.xlsx", bomb))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("cannot be read safely");
    }

    @Test
    void aCsvThatIsReallyASpreadsheetOrBinaryIsRefused() throws IOException {
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.csv", zip("xl/workbook.xml")))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("spreadsheet, not a CSV");
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.csv", new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, 1}))
                .isInstanceOf(ImportFileRejectedException.class);
        assertThatThrownBy(() -> ImportFileSniffer.sniff("a.csv", new byte[] {'a', 0, 'b'}))
                .isInstanceOf(ImportFileRejectedException.class).hasMessageContaining("text CSV");
    }

    @Test
    void thePathIsStrippedFromTheNameAndControlCharactersRemoved() {
        ImportFile file = ImportFileSniffer.sniff("C:\\Users\\me\\fixtures\u0007.csv", "a,b".getBytes(StandardCharsets.UTF_8));
        assertThat(file.name()).isEqualTo("fixtures.csv");
        assertThat(ImportFileSniffer.sniff("../../etc/x.csv", "a".getBytes(StandardCharsets.UTF_8)).name()).isEqualTo("x.csv");
    }

    @Test
    void aVeryLongNameIsShortenedKeepingItsExtension() {
        String name = "a".repeat(300) + ".csv";
        ImportFile file = ImportFileSniffer.sniff(name, "a".getBytes(StandardCharsets.UTF_8));
        assertThat(file.name()).hasSize(255).endsWith(".csv");
    }
}
