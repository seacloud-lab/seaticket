class SearchResult {
  constructor(data = {}) {
    this._id = data._id || '';
    this.type = data.type || '';
    this.connection_id = data.connection_id || '';
    this.content = data.content || '';
    this.filename = data.filename || '';
    this.title = data.title || '';
    this.url = data.url || '';
    this.path = data.path || '';
    this.repo_id = data.repo_id || '';
    this.repo_name = data.repo_name || '';
    this.server_url = data.server_url || '';
    this.score = data.score >= 0 ? data.score : 0;
  }
}

export default SearchResult;
