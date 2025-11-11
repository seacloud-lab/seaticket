class DiscourseForum {
  constructor(object) {
    this._id = object._pk || '';
    this.topic_id = object.topic_id || '';
    this.title = object.title || '';
    this.slug = object.slug || '';
    this.views = object.views || 0;
    this.modified_time = object.modified_time || '';
    this.created_time = object.created_time || '';
  }
}

export default DiscourseForum;
