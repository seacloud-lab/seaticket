class IssueForAI {
  constructor(object) {
    this._id = String(object._id || object._pk || '') || '';
    this.icon = object.state === 'closed' || object.state === '0002' ? 'circle-check' : 'circle-dot';
    this.title = object.title || '';
    this.connection_id = object.connection_id || '';
    this.url = object.url;
    this.type = 'issue';
  }
}

export {
  IssueForAI,
};
