class IssueForAI {
  constructor(object) {
    this._id = String(object._id || object._pk || '') || '';
    this.icon = object.state === 'closed' || object.state === '0002' ? 'check-circle-stroked' : 'dot-circle-stroked';
    this.title = object.title || '';
    this.connection_id = object.connection_id || '';
    this.connection_type = object.connection_type || '';
    this.url = object.url;
    this.type = 'issue';
    this.key = `${this.type}__${this._id}`;
  }
}

export {
  IssueForAI,
};
