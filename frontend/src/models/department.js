export default class Department {
  constructor(obj) {
    this.id = obj.id || null;
    this.name = obj.name || null;
    this.owner = obj.owner || null;
    this.created_at = obj.created_at || null;
    this.parent_id = obj.parent_id || obj.parent_group_id;
    this.quota = obj.quota || null;
  }
}
