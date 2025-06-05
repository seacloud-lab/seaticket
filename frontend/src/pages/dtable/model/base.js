class Base {

  constructor(obj) {
    this.id = obj.id || '';
    this.uuid = obj.uuid || '';
    this.workspace_id = obj.workspace_id || '';
    this.name = obj.name || '';
    this.icon = obj.icon || '';
    this.color = obj.color || '';
    this.starred = obj.starred || false;
    this.created_at = obj.created_at || '';
    this.creator = obj.creator || '';
    this.modifier = obj.modifier || '';
    this.updated_at = obj.updated_at || '';
  }

}

export default Base;
