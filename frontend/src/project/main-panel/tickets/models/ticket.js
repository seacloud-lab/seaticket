import dayjs from '@/utils/dayjs';
import { TICKET_STATUS } from '../constants';

class Reply {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';

    this.creator = object.creator || '';

    this.content = object.content || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';

    // update
    if (this.created_at) {
      this.created_at = dayjs(this.created_at).fromNow();
    }
    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';
  }

  _update = (content = '') => {
    if (typeof content === 'string') {
      this.content = content;
    } else {
      this.content = content?.text;
    }
    return this;
  };
}

class Ticket {
  constructor(object) {
    this.id = object._pk || '';
    this._pk = object._pk || '';

    this.title = object.title || '';
    this.content = object.description || '';
    this.status = object.status || TICKET_STATUS.OPEN;
    this.substate = object.substate || '';
    this.type = object.type || '';
    this.tags = object.tags || [];
    this.priority = object.priority || 0;

    this.assignees = object.assignees || [];
    this.participants = object.participants || [];

    this.creator = object.creator || '';
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
      this.replies = this.replies.map(reply => reply instanceof Reply ? reply : new Reply(reply));
    }

    if (this.tags) {
      this.tags = this.tags.map(id => String(id));
    }
  }

  _update = (keyValue = {}) => {
    Object.entries(keyValue).forEach(item => {
      const [key, value] = item;
      if (key !== 'replies') {
        this[key] = value;
      }
    });
    this.updated_at = dayjs(new Date()).fromNow();
    return this;
  };

  _create_reply = (reply) => {
    this.replies.push(new Reply(reply));
    this.reply_updated_at = dayjs(new Date()).fromNow();
    return this;
  };

  _delete_reply = (replyID) => {
    this.replies = this.replies.filter(reply => reply.id !== replyID);
    this.reply_updated_at = dayjs(new Date()).fromNow();
    return this;
  };

  _modify_reply = (replyID, content) => {
    const replyIndex = this.replies.findIndex(reply => reply.id === replyID);
    let reply = this.replies[replyIndex];
    reply = reply._update(content);
    this.replies[replyIndex] = reply;
    this.reply_updated_at = dayjs(new Date()).fromNow();
    return this;
  };
}

class TicketForTickets {
  constructor(object) {
    this._id = String(object._pk) || '';
    this._pk = object._pk || '';

    this.title = object.title || '';
    this.description = object.description || '';
    this.status = object.status || TICKET_STATUS.OPEN;
    this.substate = object.substate || '';
    this.type = object.type || '';
    this.tags = object.tags || [];
    this.priority = object.priority || 0;

    this.assignees = object.assignees || [];
    this.participants = object.participants || [];

    this.creator = object.creator || '';
    this.created_at = object.created_at || '';

    this.replies = object.replies || [];
    this.reply_count = object.reply_count || '';
    this.reply_updated_at = object.updated_at || '';

    this.updated_at = object.updated_at || '';

    if (this.replies) {
      this.replies = this.replies.map(reply => reply instanceof Reply ? reply : new Reply(reply));
    }

    if (this.reply_count || this.reply_count === '0') {
      this.reply_count = Number(this.reply_count);
    }

    if (this.tags) {
      this.tags = this.tags.map(id => String(id));
    }
  }
}

class TicketForAI {
  constructor(object) {
    this._id = String(object._pk) || '';
    this.title = object.title || '';
  }
}

export default Ticket;
export {
  TicketForTickets,
  TicketForAI,
  Reply,
};
