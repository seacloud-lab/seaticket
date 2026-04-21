import dayjs from '@/utils/dayjs';
import { TICKET_STATE } from '../constants';

class Comment {
  constructor(object) {
    this.id = object.number || '';
    this.number = object.number || '';

    this.creator = object.creator || '';

    this.via_agent = object.via_agent === true;

    this.content = object.content || '';

    // keep original time for sorting
    this._created_time = object.created_time || '';
    this._modified_time = object.modified_time || '';
    this.created_time = object.created_time || '';
    this.modified_time = object.modified_time || '';

    // format time for display
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
    this.due_date = object.due_date || '';


    this.comments = object.comments || [];
    this.comment_count = object.comment_count || '';

    this.modified_time = object.modified_time || '';

    this.linked_connection_records = object.linked_connection_records || [];

    // format date
    if (this.created_time) {
      this.created_time = dayjs(this.created_time).fromNow();
    }

    this.modified_time = this.modified_time ? dayjs(this.modified_time).fromNow() : '--';

    if (this.comments) {
      this.comments = this.comments.map(comment => comment instanceof Comment ? comment : new Comment(comment));
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

  _create_comment = (comment) => {
    this.comments.push(new Comment(comment));
    return this;
  };

  _delete_comment = (commentID) => {
    this.comments = this.comments.filter(comment => comment.id !== commentID);
    return this;
  };

  _modify_comment = (commentID, content) => {
    const commentIndex = this.comments.findIndex(comment => comment.id === commentID);
    let comment = this.comments[commentIndex];
    comment = comment._update(content);
    this.comments[commentIndex] = comment;
    return this;
  };
}

class TicketForAI {
  constructor(object) {
    this._id = String(object._pk) || '';
    this.record_id = object._pk;
    this.title = object.title || '';
    this.type = 'ticket';
    this.icon = 'all-tickets';
    this.key = `${this.type}__${this._id}`;
  }
}

export default Ticket;
export {
  TicketForAI,
  Comment,
};
