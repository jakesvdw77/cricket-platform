package com.cricketlegend.service.support;

import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;

/** A CSV template carries the header only (docs/specs/097-import-framework.md); UTF-8 with a BOM so Excel opens it right. */
public final class CsvTemplateWriter {

    private CsvTemplateWriter() {
    }

    public static byte[] header(List<String> headers) {
        StringWriter out = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(out, CSVFormat.DEFAULT)) {
            printer.printRecord(headers);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
        return ("﻿" + out).getBytes(StandardCharsets.UTF_8);
    }
}
