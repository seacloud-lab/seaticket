import dayjs from '@/utils/dayjs';
import { TICKET_STATE } from '../constants';

class Reply {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';

    this.creator = object.creator || '';

    this.content = object.content || '';
    this.created_time = object.created_time || '';
    this.updated_time = object.updated_time || '';

    // update
    if (this.created_time) {
      this.created_time = dayjs(this.created_time).fromNow();
    }
    this.updated_time = this.updated_time ? dayjs(this.updated_time).fromNow() : '--';
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
    this.content = object.content || '';
    this.state = object.state || TICKET_STATE.OPEN;
    this.substate = object.substate || '';
    this.type = object.type || '';
    this.tags = object.tags || [];
    this.priority = object.priority || 0;

    this.assignees = object.assignees || [];
    this.participants = object.participants || [];

    this.creator = object.creator || '';
    this.created_time = object.created_time || '';

    this.replies = object.replies || [];
    this.reply_count = object.reply_count || '';

    this.updated_time = object.updated_time || '';

    // format date
    if (this.created_time) {
      this.created_time = dayjs(this.created_time).fromNow();
    }

    this.updated_time = this.updated_time ? dayjs(this.updated_time).fromNow() : '--';

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
    this.updated_time = dayjs(new Date()).fromNow();
    return this;
  };

  _create_reply = (reply) => {
    this.replies.push(new Reply(reply));
    return this;
  };

  _delete_reply = (replyID) => {
    this.replies = this.replies.filter(reply => reply.id !== replyID);
    return this;
  };

  _modify_reply = (replyID, content) => {
    const replyIndex = this.replies.findIndex(reply => reply.id === replyID);
    let reply = this.replies[replyIndex];
    reply = reply._update(content);
    this.replies[replyIndex] = reply;
    return this;
  };
}

class TicketForTickets {
  constructor(object) {
    this._id = String(object._pk) || '';
    this._pk = object._pk || '';

    this.title = object.title || '';
    this.content = object.content || '';
    this.state = object.state || TICKET_STATE.OPEN;
    this.substate = object.substate || '';
    this.type = object.type || '';
    this.tags = object.tags || [];
    this.priority = object.priority || 0;

    this.assignees = object.assignees || [];
    this.participants = object.participants || [];

    this.creator = object.creator || '';
    this.created_time = object.created_time || '';

    this.replies = object.replies || [];
    this.reply_count = object.reply_count || '';

    this.updated_time = object.updated_time || '';

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
