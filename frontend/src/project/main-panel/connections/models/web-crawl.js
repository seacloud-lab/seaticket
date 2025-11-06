class WebCrawl {
  constructor(object) {
    this._id = object._pk || '';
    this.title = object.title || '';
    this.url = object.url || '';
    this.modified_time = object.modified_time || '';
  }
}

export default WebCrawl;
