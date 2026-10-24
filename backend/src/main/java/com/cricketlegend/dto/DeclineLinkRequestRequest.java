package com.cricketlegend.dto;

import jakarta.validation.constraints.Size;

/** {@code POST .../link-requests/{id}/decline}: an optional note shown to the requester. */
public record DeclineLinkRequestRequest(@Size(max = 500) String note) {}
