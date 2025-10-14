class DiscourseForum {
  constructor(object) {
    this._id = object._pk || '';
    this.topic_id = object.topic_id || '';
    this.title = object.title || '';
    this.slug = object.slug || '';
    this.views = object.views || 0;
    this.bumped_at = object.bumped_at || '';
    this.connection_id = object.connection_id || '';
    this.deleted = Boolean(object.deleted);
    this.created_at = object.created_at || '';
  }
}

export default DiscourseForum;
