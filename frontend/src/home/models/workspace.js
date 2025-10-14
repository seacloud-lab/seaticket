class Workspace {

  constructor(obj) {
    this.id = obj.id || '';
    this.name = obj.name || '';
    this.type = obj.type || '';
    this.projects = obj.projects || [];
    this.group_id = obj.group_id || '';
    this.group_owner = obj.group_owner || '';
    this.is_admin = obj.is_admin || false;
  }

}

export default Workspace;
