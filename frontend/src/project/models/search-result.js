class SiteResult {
  constructor(object) {
    this.id = object._id || '';
    this.connection_id = object.connection_id || '';
    this.title = object.title || '';
    this.score = object.score || 0;
    this.url = object.url || '';
    this.content = object.content || '';
  }
}

class SeafileResult {
  constructor(object) {
    this.id = object._id || '';
    this.connection_id = object.connection_id || '';
    this.filename = object.filename || '';
    this.path = object.path || 0;
    this.repo_id = object.repo_id || '';
    this.content = object.content || '';
  }
}

class SeafileResult1 {
  constructor(object, object2) {
    this.site = object._id || '';
    this.connection_id = object.connection_id || '';
    this.filename = object.filename || '';
    this.path = object.path || 0;
    this.repo_id = object.repo_id || '';
    this.content = object.content || '';
  }
}

const SearchResults = (results) => {
  const siteResults = results.site_list ? results.site_list.map(r => new SiteResult(r)) : [];
  const seafileResults = results.seafile_list ? results.seafile_list.map(r => new SeafileResult(r)) : [];
  return { 'site_list': siteResults, 'seafile_list': seafileResults };
};

export { SiteResult, SeafileResult, SearchResults };
