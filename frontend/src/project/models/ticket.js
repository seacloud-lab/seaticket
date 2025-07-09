import dayjs from '../../utils/dayjs';
import ReplyObject from './reply';

class TicketObject {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';
    this.name = object.name || '';
    this.email = object.email || '';
    this.avatar_url = object.avatar_url || '';
    this.contact_email = object.contact_email || '';
    this.title = object.title || '';
    this.content = object.content || '';
    this.status = object.status || '';
    this.tags = object.tags || [];
    this.participants = object.participants || [];
    this.reply_count = object.reply_count || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';
    this.reply_updated_at = object.reply_updated_at || '';
    this.replies = object.replies || [];

    // update
    if (this.created_at) {
      this.created_at = dayjs(this.created_at).format('YYYY-MM-DD HH:mm:ss');
    }

    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';
    this.reply_updated_at = this.reply_updated_at ? dayjs(this.reply_updated_at).fromNow() : '--';

    if (this.replies) {
      this.replies = this.replies.map(reply => {
        return (
          new ReplyObject(reply)
        );
      });
    }
  }
}

export default TicketObject;
