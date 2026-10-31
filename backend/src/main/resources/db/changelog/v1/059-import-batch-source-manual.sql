-- docs/specs/125-editable-import-rows.md: an import started without a file has source MANUAL. The check constraint added in
-- 058 only allowed the file and AI sources, so a typed-in import was refused ("A conflicting record already exists").
ALTER TABLE import_batch DROP CONSTRAINT ck_import_batch_source;
ALTER TABLE import_batch ADD CONSTRAINT ck_import_batch_source CHECK (source IN ('TEMPLATE_FILE', 'AI_TRANSFORM', 'MANUAL'));
