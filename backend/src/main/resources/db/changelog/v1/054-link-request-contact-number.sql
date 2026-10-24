-- docs/specs/119: a contact number on a link request so the manager can follow up. Nullable: rows created before
-- this migration have none, new requests are required to carry one by the API.
ALTER TABLE link_request ADD COLUMN contact_number VARCHAR(30);
