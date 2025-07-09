import dayjs from '../../utils/dayjs';

class ReplyObject {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';
    this.name = object.name || '';
    this.email = object.email || '';
    this.avatar_url = object.avatar_url || '';
    this.contact_email = object.contact_email || '';
    this.content = object.content || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';

    // update
    if (this.created_at) {
      this.created_at = dayjs(this.created_at).format('YYYY-MM-DD HH:mm:ss');
    }
    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';
  }
}

export default ReplyObject;
