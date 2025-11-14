class GithubIssue {
  constructor(object) {
    this._id = object._pk || '';
    this.title = object.title || '';
    this.ai_summary = object.ai_summary || '';
    this.body = object.content || '';
    this.state = object.state || 'open';
    this.state_reason = object.state_reason || '';
    this.labels = object.labels || [];
    this.issue_type = object.issue_type || '';
    this.author = object.author || '';
    this.assignees = object.assignees || '';
    this.url = object.url || '';
    this.created_time = object.created_time || '';
    this.modified_time = object.modified_time || '';
    this.closed_at = object.closed_at || '';
    this.comments_count = object.comments_count || '';
    this.ai_processed_time = object.ai_processed_time || '';
  }
}

class IssueForAI {
  constructor(object) {
    this._id = String(object._id || object._pk || '') || '';
    this.title = object.title || '';
    this.connection_id = object.connection_id || '';
  }
}

export default GithubIssue;
export {
  IssueForAI,
};
