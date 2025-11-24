import dayjs from '@/utils/dayjs';
import { TICKET_STATE } from '../constants';

class Comment {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';

    this.creator = object.creator || '';

    this.content = object.content || '';
    this.created_time = object.created_time || '';
    this.modified_time = object.modified_time || '';

    // update
    if (this.created_time) {
      this.created_time = dayjs(this.created_time).fromNow();
    }
    this.modified_time = this.modified_time ? dayjs(this.modified_time).fromNow() : '--';
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
    this.closed_time = object.closed_time || '';


    this.comments = object.comments || [];
    this.reply_count = object.reply_count || '';

    this.modified_time = object.modified_time || '';

    // format date
    if (this.created_time) {
      this.created_time = dayjs(this.created_time).fromNow();
    }

    this.modified_time = this.modified_time ? dayjs(this.modified_time).fromNow() : '--';

    if (this.comments) {
      this.comments = this.comments.map(reply => reply instanceof Comment ? reply : new Comment(reply));
    }

    if (this.tags) {
      this.tags = this.tags.map(id => String(id));
    }
  }

  _update = (keyValue = {}) => {
    Object.entries(keyValue).forEach(item => {
      const [key, value] = item;
      if (key !== 'comments') {
        this[key] = value;
      }
    });
    this.modified_time = dayjs(new Date()).fromNow();
    return this;
  };

  _create_reply = (reply) => {
    this.comments.push(new Comment(reply));
    return this;
  };

  _delete_reply = (replyID) => {
    this.comments = this.comments.filter(reply => reply.id !== replyID);
    return this;
  };

  _modify_reply = (replyID, content) => {
    const replyIndex = this.comments.findIndex(reply => reply.id === replyID);
    let reply = this.comments[replyIndex];
    reply = reply._update(content);
    this.comments[replyIndex] = reply;
    return this;
  };
}

class TicketForAI {
  constructor(object) {
    this._id = String(object._pk) || '';
    this.title = object.title || '';
  }
}

export default Ticket;
export {
  TicketForAI,
  Comment,
};
