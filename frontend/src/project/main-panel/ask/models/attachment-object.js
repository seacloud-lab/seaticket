import slugid from 'slugid';
import { gettext } from '@/constants';
import { CHAT_ATTACHMENT_TYPE } from '../constants';

const ATTACHMENT_TYPE_NAMES = {
  [CHAT_ATTACHMENT_TYPE.TICKET]: gettext('Ticket'),
  [CHAT_ATTACHMENT_TYPE.EMAIL]: gettext('Email'),
  [CHAT_ATTACHMENT_TYPE.GITHUB_ISSUE]: gettext('GitHub issue'),
  [CHAT_ATTACHMENT_TYPE.SEAFILE]: gettext('Seafile library'),
  [CHAT_ATTACHMENT_TYPE.NOTION]: gettext('Notion'),
  [CHAT_ATTACHMENT_TYPE.SITE]: gettext('Site'),
  [CHAT_ATTACHMENT_TYPE.GENERAL_TASK]: gettext('General tasks'),
  [CHAT_ATTACHMENT_TYPE.DISCOURSE_FORUM]: gettext('Discourse forum'),
  [CHAT_ATTACHMENT_TYPE.IMAGE]: gettext('Image'),
  [CHAT_ATTACHMENT_TYPE.PAGE_CONTENT]: gettext('Page content'),
};

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
    if (this.type === CHAT_ATTACHMENT_TYPE.PAGE_CONTENT) {
      this.icon = 'new-page';
      this.content = object.content || '';
      this.url = object.url || '';
    }
    this.type_name = ATTACHMENT_TYPE_NAMES[this.type] || '';
  }

  to_json = () => {
    if (this.type === CHAT_ATTACHMENT_TYPE.IMAGE) return { type: this.type, path: this.path };
    if (this.type === CHAT_ATTACHMENT_TYPE.TICKET) return { type: this.type, record_id: this.record_id };
    if (this.type === CHAT_ATTACHMENT_TYPE.PAGE_CONTENT) {
      return { type: this.type, url: this.url, title: this.title, content: this.content };
    }
    return {
      type: this.type,
      connection_id: this.connection_id,
      record_id: this.record_id
    };
  };
}

export default AttachmentObject;
