class WebCrawl {
  constructor(object) {
    this._id = object._pk || '';
    this.title = object.title || '';
    this.url = object.url || '';
    this.last_modified = object.last_modified || '';
  }
}

export default WebCrawl;
