class SearchResult {
  constructor(object) {
    this.id = object._id || '';
    this.site_id = object.site_id || '';
    this.title = object.title || '';
    this.score = object.score || 0;
    this.url = object.url || '';
    this.content = object.content || '';
  }
}

export default SearchResult;
