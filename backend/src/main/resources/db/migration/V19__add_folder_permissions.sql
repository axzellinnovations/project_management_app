CREATE TABLE IF NOT EXISTS document_folder_permissions (
    id          BIGSERIAL PRIMARY KEY,
    folder_id   BIGINT NOT NULL REFERENCES document_folders(id) ON DELETE CASCADE,
    team_role   VARCHAR(30) NOT NULL,
    permission  VARCHAR(20) NOT NULL,
    granted_by  BIGINT REFERENCES users(user_id),
    granted_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(folder_id, team_role, permission)
);

INSERT INTO document_folder_permissions (folder_id, team_role, permission)
SELECT id, 'ADMIN', 'MANAGE' FROM document_folders
ON CONFLICT (folder_id, team_role, permission) DO NOTHING;

INSERT INTO document_folder_permissions (folder_id, team_role, permission)
SELECT id, 'MEMBER', 'READ' FROM document_folders
ON CONFLICT (folder_id, team_role, permission) DO NOTHING;

INSERT INTO document_folder_permissions (folder_id, team_role, permission)
SELECT id, 'MEMBER', 'WRITE' FROM document_folders
ON CONFLICT (folder_id, team_role, permission) DO NOTHING;

INSERT INTO document_folder_permissions (folder_id, team_role, permission)
SELECT id, 'VIEWER', 'READ' FROM document_folders
ON CONFLICT (folder_id, team_role, permission) DO NOTHING;
