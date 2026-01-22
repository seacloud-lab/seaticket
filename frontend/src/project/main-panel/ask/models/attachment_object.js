import { CONNECTION_TYPE } from '../../connections/constants';
import { TICKET_TYPE } from '../../tickets/constants';

class AttachmentObject {
  constructor(object) {
    const record_id = object._id || object._pk || -1;
    this._id = String(record_id);
    this.title = object.title || '';
    this.type = object.type || '';
    this.connection_id = object.connection_id || '';
    this.key = `${this.type}_${this.connection_id}_${this._id}`;
    this.icon = (
      this.type === TICKET_TYPE ||
      this.type === CONNECTION_TYPE.EMAIL ||
      this.type === CONNECTION_TYPE.GITHUB_ISSUE ||
      this.type === CONNECTION_TYPE.DISCOURSE_FORUM
    ) ? 'dot-circle-stroked' : 'document';
  }
}

export default AttachmentObject;
