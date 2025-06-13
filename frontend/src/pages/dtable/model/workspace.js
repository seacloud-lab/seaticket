class Workspace {

  constructor(obj) {
    this.id = obj.id || '';
    this.name = obj.name || '';
    this.type = obj.type || '';
    this.project_list = obj.project_list || [];
    this.folders = obj.folders || [];

    // type === shared
    this.share_folders = obj.share_folders || [];
    this.shared_project_list = obj.shared_project_list || [];

    // type === group
    this.group_id = obj.group_id || '';
    this.group_owner = obj.group_owner || '';
    this.group_shared_dtables = obj.group_shared_dtables || [];
    this.is_admin = obj.is_admin || false;
    this.department_id = obj.department_id || '';
  }

}

export default Workspace;
