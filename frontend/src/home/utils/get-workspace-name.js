export default function getWorkspaceName(table, workspaces) {
  const targetId = table.workspace_id;
  const targetWorkspace = workspaces.find(workspace => {
    if (workspace.id === targetId) return true;
    return false;
  });
  return targetWorkspace ? targetWorkspace.name : '';
}
