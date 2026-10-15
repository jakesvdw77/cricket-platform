package com.cricketlegend.service.impl;

import com.cricketlegend.dto.AdaptorCatalogueDto;
import com.cricketlegend.dto.ImportLimitsDto;
import com.cricketlegend.mapper.AdaptorMapper;
import com.cricketlegend.service.ResultImportService;
import com.cricketlegend.service.adaptor.AdaptorRegistry;
import org.springframework.stereotype.Service;

@Service
public class ResultImportServiceImpl implements ResultImportService {

    private final AdaptorRegistry adaptorRegistry;
    private final AdaptorMapper adaptorMapper;

    public ResultImportServiceImpl(AdaptorRegistry adaptorRegistry, AdaptorMapper adaptorMapper) {
        this.adaptorRegistry = adaptorRegistry;
        this.adaptorMapper = adaptorMapper;
    }

    /** No database access and no lazy fields, so no transaction is needed. */
    @Override
    public AdaptorCatalogueDto listAdaptors() {
        return new AdaptorCatalogueDto(
                adaptorRegistry.all().stream().map(adaptorMapper::toDescriptor).toList(), ImportLimitsDto.current());
    }
}
