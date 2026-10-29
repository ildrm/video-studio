ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS projects_workspace_archive_created ON projects(workspace_id,archived_at,created_at,id) WHERE deleted_at IS NULL;
