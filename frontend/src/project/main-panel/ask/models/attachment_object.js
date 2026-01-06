import { CONNECTION_TYPE } from '../../connections/constants';

class AttachmentObject {
  constructor(object) {
    this.record_id = object._id || object._pk || object.record_id || -1;
    this._id = String(this.record_id);
    this.title = object.title || '';
    this.type = object.type || '';
    this.connection_id = object.connection_id || '';
    this.key = `${this.type}_${this.connection_id}_${this._id}`;

    if (this.type === 'ticket') {
      this.icon = 'all-tickets';
    } else if (this.type === 'knowledge_base') {
      this.icon = 'knowledge-base';
    } else if (this.type === CONNECTION_TYPE.SITE) {
      this.icon = 'site';
    } else if (this.type === CONNECTION_TYPE.SEAFILE) {
      this.icon = 'seafile';
    } else if (this.type === CONNECTION_TYPE.GITHUB_ISSUE) {
      this.icon = object.state === 'closed' || object.state === '0002' ? 'circle-check' : 'circle-dot';
    } else if (this.type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      this.icon = 'discourse_forum';
    } else if (this.type === CONNECTION_TYPE.EMAIL) {
      this.icon = 'email';
    } else {
      this.icon = '';
    }

    console.log(this);

  }
}

export default AttachmentObject;
