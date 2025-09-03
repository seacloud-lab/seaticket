import { CONNECTION_TYPE } from '../../connections/constants';

class SearchResult {
  constructor(data = {}) {
    this._id = data._id || '';
    this.connection_id = data.connection_id || '';
    this.type = data.type || '';
    this.score = data.score >= 0 ? data.score : 0;

    this.title = data.title || '';
    this.url = data.url || '';
    this.content = data.content || '';
    this.bumped_at = data.bumped_at || '';

    if (this.type === CONNECTION_TYPE.SEAFILE) {
      const filename = data.filename || '';
      const repoName = data.repo_name || '';

      let serverURL = data.server_url || '';
      if (serverURL.endsWith('/')) {
        serverURL = serverURL.slice(0, -1);
      }
      const path = data.path || '';
      const folderPath = path.endsWith('/') ? path.slice(0, -1) : path;
      let filePath = folderPath + '/' + filename;
      if (!filePath.startsWith('/')) {
        filePath = '/' + filePath;
      }
      this.title = filename;
      this.url = `${serverURL}/lib/${data.repo_id || ''}/file${filePath}`;
      this.subtitle = repoName + filePath;
    }
    if (this.type === CONNECTION_TYPE.SITE) {
      this.subtitle = this.url;
    }
  }
}

export default SearchResult;
