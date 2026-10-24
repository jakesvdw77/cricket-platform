-- docs/specs/119 Decision 31: a link request carries the section the requester chose, so it reaches the right manager.
-- Nullable: rows created before this migration, and requests to a club with no sections, have none.
ALTER TABLE link_request ADD COLUMN section_id UUID REFERENCES section (id);
CREATE INDEX ix_link_request_section ON link_request (section_id);
