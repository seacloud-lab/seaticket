import { Ticket, Comment } from '@/project/main-panel/tickets/models';
import { PORTAL_ISSUE_TYPE } from '../constants';

class Issue extends Ticket {
  constructor(object) {
    super(object);
  }
}

class IssueForAI {
  constructor(object) {
    this._id = String(object._pk) || '';
    this.record_id = object._pk;
    this.title = object.title || '';
    this.type = PORTAL_ISSUE_TYPE;
    this.icon = 'all-tickets';
    this.key = `${this.type}__${this._id}`;
  }
}

export default Issue;
export {
  IssueForAI,
  Comment,
};
