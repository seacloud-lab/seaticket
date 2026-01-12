class AttachmentObject {
  constructor(object) {
    this.record_id = object._id || object._pk || object.record_id || -1;
    this._id = String(this.record_id);
    this.title = object.title || '';
    this.type = object.type || '';
    this.connection_id = object.connection_id || '';
    this.key = `${this.type}_${this.connection_id}_${this._id}`;
    this.icon = this.type === 'ticket' ? 'dot-circle-stroked' : 'document';
  }
}

export default AttachmentObject;
