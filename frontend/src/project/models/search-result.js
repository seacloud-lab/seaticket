class Result {
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
    this.score = data.score >= 0 ? data.score : 0;
  }
}

const getSearchResults = (results) => {
  return results.map(r => new Result(r));
};

export { getSearchResults };
