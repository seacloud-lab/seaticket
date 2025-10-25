class Seafile {
  constructor(object) {
    this._id = object._pk || '';
    this.path = object.path || '';
    this.filename = object.filename || '';
    this.mtime = object.mtime || '';
    this.deleted = Boolean(object.deleted);
    this.updated_at = object.updated_at || '';
  }
}

export default Seafile;
