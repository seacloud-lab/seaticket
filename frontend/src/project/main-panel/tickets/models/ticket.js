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
    const pk = object['tickets._pk'] ?? object._id ?? object.id ?? '';
    this.id = pk;
    this._pk = pk;

    this.title = object['tickets.title'] || '';
    this.content = object['tickets.content'] || '';
    this.state = object['tickets.state'] || TICKET_STATE.OPEN;
    this.substate = object['tickets.substate'] || '';
    this.type = object['tickets.type'] || '';
    this.tags = object['project_tags.tags'] || [];
    this.priority = object['tickets.priority'] || 0;

    this.assignees = object['tickets.assignees'] || [];
    console.log('Ticket assignees:', this.assignees);
    this.participants = object['tickets.participants'] || [];

    this.creator = object['tickets.creator'] || '';
    this.created_time = object['tickets.created_time'] || '';
    this.closed_time = object['tickets.closed_time'] || '';


    this.comments = object['tickets.comments'] || [];
    this.comment_count = object['tickets.comment_count'] || '';

    this.modified_time = object['tickets.modified_time'] || '';

    // format date
    if (this.created_time) {
      this.created_time = dayjs(this.created_time).fromNow();
    }

    this.modified_time = this.modified_time ? dayjs(this.modified_time).fromNow() : '--';

    if (this.comments) {
      this.comments = this.comments.map(comment => comment instanceof Comment ? comment : new Comment(comment));
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
    const normalized = { ...object };
    Object.keys(object || {}).forEach((k) => {
      if (!k || typeof k !== 'string') return;
      if (!k.startsWith('tickets.')) return;
      const key = k.slice('tickets.'.length);
      if (!key) return;
      if (normalized[key] === undefined) {
        normalized[key] = object[k];
      }
    });

    const pk = normalized._pk ?? normalized._id ?? normalized.id;
    this._id = pk !== undefined && pk !== null ? String(pk) : '';
    this.title = normalized.title || '';
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
