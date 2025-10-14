class GithubIssue {
  constructor(object) {
    this._id = object._pk || '';
    this.issue_id = object.issue_id || '';
    this.issue_number = object.issue_number || '';
    this.title = object.title || '';
    this.body = object.body || '';
    this.status = object.state || 'open';
    this.state_reason = object.state_reason || '';
    this.labels = object.labels || [];
    this.type = object.issue_type || '';
    this.author = object.author || '';
    this.assignees = object.assignees || '';
    this.url = object.url || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';
    this.closed_at = object.closed_at || '';
    this.comments = object.comments || '';
    this.connection_id = object.connection_id || '';
    this.deleted = Boolean(object.deleted);
  }
}

export default GithubIssue;
