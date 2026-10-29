BEGIN;
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_kind_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_kind_check CHECK (kind IN ('unknown','video','audio','image','font'));
COMMIT;
