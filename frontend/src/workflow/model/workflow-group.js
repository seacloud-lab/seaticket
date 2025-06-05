class WorkflowGroup {
  constructor(obj = {}) {
    this.id = obj.id || '';
    this.owner = obj.owner || '';
    this.token = obj.token || '';
    this.visit_times = obj.visit_times || 0;

    // group
    this.group_id = obj.group_id || -1;
    this.group_name = obj.group_name || '';
    this.group_owner = obj.group_owner || '';

    // creat
    this.created_at = obj.created_at || '';
    this.creator = obj.creator || '';

    // permission
    this.is_admin = obj.is_admin || false;
    this.is_shared = obj.is_shared || false;

    // task count
    this.ongoing_tasks_count = obj.ongoing_tasks_count || 0;
    this.initiated_tasks_count = obj.initiated_tasks_count || 0;

    // config
    this.dtable_uuid = obj.dtable_uuid || '';
    this.workflow_config = obj.workflow_config || '{}';

    // link
    this.workflow_edit_link = obj.workflow_edit_link || '';

    // corresponding base
    this.dtable_name = obj.dtable_name || '';
    this.workspace_id = obj.workspace_id || -1;

    // folder
    this.folder_id = obj.folder_id || '/';
    this.is_shared = obj.is_shared || false;
    this.share_id = obj.share_id || '';
  }
}

export default WorkflowGroup;
