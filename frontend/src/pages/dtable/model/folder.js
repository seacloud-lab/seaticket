class Folder {
  constructor(obj) {
    this.id = obj.id || '';
    this.name = obj.name || '';
    this.color = obj.color || '';
    this.workspace_id = obj.workspace_id || '';
    this.items = obj.items || [];
  }
}

export default Folder;
