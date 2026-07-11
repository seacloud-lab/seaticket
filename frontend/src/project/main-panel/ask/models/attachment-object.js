import slugid from 'slugid';
import { gettext } from '@/constants';
import { CHAT_ATTACHMENT_TYPE } from '../constants';

class AttachmentObject {
  constructor(object) {
    this.record_id = object._id || object._pk || object.record_id || -1;
    this._id = this.record_id !== -1 ? String(this.record_id) : slugid.nice();
    this.title = object.title || '';
    this.type = object.type || '';
    this.connection_id = object.connection_id || '';
    this.key = `${this.type}_${this.connection_id}_${this._id}`;
    this.icon = (
      this.type === CHAT_ATTACHMENT_TYPE.TICKET ||
      this.type === CHAT_ATTACHMENT_TYPE.EMAIL ||
      this.type === CHAT_ATTACHMENT_TYPE.GITHUB_ISSUE ||
      this.type === CHAT_ATTACHMENT_TYPE.DISCOURSE_FORUM
    ) ? 'dot-circle-stroked' : 'document';
    if (this.type === CHAT_ATTACHMENT_TYPE.IMAGE) {
      this.status = object.status || 'done'; // uploading, failed, done
      this.path = object.path || object.value || '';
      this.preview_path = object.preview_path || '';
      this.image = object.image || null;
      this.icon = 'image';
    }
    this.type_name = '';
    if (this.type === CHAT_ATTACHMENT_TYPE.TICKET) {
      this.type_name = gettext('Ticket');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.EMAIL) {
      this.type_name = gettext('Email');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.GITHUB_ISSUE) {
      this.type_name = gettext('GitHub issue');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.SEAFILE) {
      this.type_name = gettext('Seafile library');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.NOTION) {
      this.type_name = gettext('Notion');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.SITE) {
      this.type_name = gettext('Site');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.GENERAL_TASK) {
      this.type_name = gettext('General tasks');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.DISCOURSE_FORUM) {
      this.type_name = gettext('Discourse forum');
    } else if (this.type === CHAT_ATTACHMENT_TYPE.IMAGE) {
      this.type_name = 'Image';
    }
  }

  to_json = () => {
    if (this.type === CHAT_ATTACHMENT_TYPE.IMAGE) return { type: this.type, path: this.path };
    if (this.type === CHAT_ATTACHMENT_TYPE.TICKET) return { type: this.type, record_id: this.record_id };
    return {
      type: this.type,
      connection_id: this.connection_id,
      record_id: this.record_id
    };
  };
}

export default AttachmentObject;
