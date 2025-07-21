import dayjs from '../../utils/dayjs';
import User from '../../models/user';

class Reply {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';

    this.creator = object.creator ? JSON.parse(object.creator) : {};

    this.content = object.content || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';

    // update
    if (this.created_at) {
      this.created_at = dayjs(this.created_at).fromNow();
    }
    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';

    if (this.creator) {
      this.creator = new User(this.creator);
    }
  }
}


class Ticket {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';

    this.title = object.title || '';
    this.content = object.content || '';
    this.status = object.status || '';
    this.type = object.type || '';
    this.tags = object.tags || [];
    this.participants = object.participants || [];

    this.creator = object.creator ? JSON.parse(object.creator) : {};
    this.created_at = object.created_at || '';

    this.replies = object.replies || [];
    this.reply_count = object.reply_count || '';
    this.reply_updated_at = object.reply_updated_at || '';

    this.updated_at = object.updated_at || '';

    // format date
    if (this.created_at) {
      this.created_at = dayjs(this.created_at).fromNow();
    }

    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';
    this.reply_updated_at = this.reply_updated_at ? dayjs(this.reply_updated_at).fromNow() : '--';

    if (this.replies) {
      this.replies = this.replies.map(reply => new Reply(reply));
    }

    if (this.creator) {
      this.creator = new User(this.creator);
    }
  }

  update = (keyValue = {}) => {
    Object.entries(keyValue).forEach(item => {
      const [key, value] = item;
      if (key !== 'replies') {
        this[key] = value;
      }
    });
    this.updated_at = dayjs(new Date()).fromNow();
  };

  toggle_status = (status = '') => {
    this.status = status;
  };

  create_reply = (reply) => {
    this.replies.push(new Reply(reply));
    this.reply_updated_at = dayjs(new Date()).fromNow();
  };

  delete_reply = (reply) => {
    // todo
    this.reply_updated_at = dayjs(new Date()).fromNow();
  };

  modify_reply = (reply) => {
    // todo
    this.reply_updated_at = dayjs(new Date()).fromNow();
  };
}

export default Ticket;
export {
  Reply,
};
