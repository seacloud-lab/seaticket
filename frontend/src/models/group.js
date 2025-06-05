class Group {
  constructor(obj) {
    this.id = obj.id;
    this.name = obj.name || '';
    this.owner = obj.owner || '';
    this.admins = obj.admins || [];
    this.avatar_url = obj.avatar_url || '';
    this.created_at = obj.created_at || '';
    this.parent_group_id = obj.parent_group_id > -1 ? obj.parent_group_id : -1;
  }
}

export default Group;
