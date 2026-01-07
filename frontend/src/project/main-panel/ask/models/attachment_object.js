import { CONNECTION_TYPE, EXTRA_SOURCES_TYPE } from '../../connections/constants';

class AttachmentObject {
  constructor(object) {
    this.record_id = object._id || object._pk || object.record_id || -1;
    this._id = String(this.record_id);
    this.title = object.title || '';
    this.type = object.type || '';
    this.connection_id = object.connection_id || '';
    this.key = `${this.type}_${this.connection_id}_${this._id}`;
    this.icon = (
      this.type === EXTRA_SOURCES_TYPE.TICKET ||
      this.type === CONNECTION_TYPE.EMAIL ||
      this.type === CONNECTION_TYPE.GITHUB_ISSUE ||
      this.type === CONNECTION_TYPE.DISCOURSE_FORUM
    ) ? 'dot-circle-stroked' : 'document';
  }
}

export default AttachmentObject;
