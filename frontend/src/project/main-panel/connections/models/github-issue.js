class GithubIssue {
  constructor(object) {
    this._id = object._pk || '';
    this.issue_id = object.issue_id || '';
    this.issue_number = object.issue_number || '';
    this.title = object.title || '';
    this.body = object.body || '';
    this.status = object.state || 'open';
    this.status_reason = object.state_reason || 'open';
    this.labels = object.labels || '';
    this.type = object.issue_type || '';
    this.author = object.author || '';
    this.assignees = object.assignees || '';
    this.url = object.url || '';
    this.created_at = object.created_at || '';
    this.updated_at = object.updated_at || '';
    this.closed_at = object.closed_at || '';
    this.comments = object.comments || '';
    this.connection_id = object.connection_id || '';
    this.need_index = object.need_index || '';
    this.deleted = Boolean(object.deleted);

    if (this.labels) {
      try {
        const value = JSON.parse(this.labels);
        this.labels = value.join(', ');
      } catch {
        this.labels = '';
      }
    }
  }
}

export default GithubIssue;
