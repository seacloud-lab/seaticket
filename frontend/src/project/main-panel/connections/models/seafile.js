class Seafile {
  constructor(object) {
    this._id = object._pk || '';
    this.path = object.path || '';
    this.title = object.title || '';
    this.modified_time = object.modified_time || '';
    this.sync_time = object.sync_time || '';
    this.ai_summary = object.ai_summary || '';
    this.ai_processed_time = object.ai_processed_time || '';
  }
}

export default Seafile;
