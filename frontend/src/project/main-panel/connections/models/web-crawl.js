class WebCrawl {
  constructor(object) {
    this._id = object._pk || '';
    this.title = object.title || '';
    this.url = object.url || '';
    this.modified_time = object.modified_time || '';
    this.ai_processed_time = object.ai_processed_time || '';
    this.ai_summary = object.ai_summary || '';
  }
}

export default WebCrawl;
