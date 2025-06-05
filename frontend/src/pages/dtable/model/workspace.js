class Workspace {

  constructor(obj) {
    this.id = obj.id || '';
    this.name = obj.name || '';
    this.type = obj.type || '';
    this.table_list = obj.table_list || [];
    this.folders = obj.folders || [];

    // type === shared
    this.share_folders = obj.share_folders || [];
    this.shared_table_list = obj.shared_table_list || [];
    this.shared_view_list = obj.shared_view_list || [];

    // type === group
    this.group_id = obj.group_id || '';
    this.group_owner = obj.group_owner || '';
    this.group_shared_dtables = obj.group_shared_dtables || [];
    this.group_shared_views = obj.group_shared_views || [];
    this.is_admin = obj.is_admin || false;
    this.department_id = obj.department_id || '';
  }

}

export default Workspace;
