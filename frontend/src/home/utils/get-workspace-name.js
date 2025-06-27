export default function getWorkspaceName(table, workspaces) {
  const targetId = table.workspace_id;
  const targetWorkspace = workspaces.find(workspace => {
    if (workspace.id === targetId) {
      return true;
    }
    let isGroupShared = false;
    workspace.group_shared_projects.forEach(item => {
      if (item.uuid === table.uuid) {
        isGroupShared = true;
      }
    });
    return isGroupShared;
  });
  return targetWorkspace ? targetWorkspace.name : '';
}
