package com.cricketlegend.repository;

import com.cricketlegend.domain.PlayingArea;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * Distinct-value projections over {@link PlayingArea} for the directory's filter options, so the database returns only
 * the distinct values instead of every matching entity.
 */
public interface PlayingAreaRepositoryCustom {

    /**
     * {@code select distinct trim(address.<attribute>)} over the rows matching {@code spec}, skipping null and blank
     * values. {@code addressAttribute} is an {@code Address} attribute: {@code country}, {@code provinceState} or
     * {@code city}. Unordered and case-sensitive: the caller de-duplicates ignoring case and sorts.
     */
    List<String> findDistinctAddressValues(Specification<PlayingArea> spec, String addressAttribute);
}
