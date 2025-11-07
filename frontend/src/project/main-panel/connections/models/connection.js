class Connection {
  constructor(object) {
    this.id = object.id || '';
    this.name = object.name || '';
    this.type = object.type || '';
    this.config = object.config || {};
    this.modifier = object.modifier || '';
    this.ctime = object.created_at || '';
    this.indexed_at = object.indexed_at || '';
    this.last_sync_time = object.last_sync_time || '';
    this.project_id = object.project_id || '';
    this.status = object.status || '{}';
    this.ai_status = object.ai_status || '{}';
    this.is_active = object.is_active || '';
    this.last_ai_processing_time = object.last_ai_processing_time || '';
    this.ai_indexed_at = object.ai_indexed_at || '';
    this.content_vector_status = object.content_vector_status || '{}';
    this.vector_indexed_at = object.vector_indexed_at || '';

    if (this.status) {
      try {
        this.status = JSON.parse(this.status);
      } catch {
        this.status = {};
      }
    }

    if (this.ai_status) {
      try {
        this.ai_status = JSON.parse(this.ai_status);
      } catch {
        this.ai_status = {};
      }
    }

    if (this.content_vector_status) {
      try {
        this.content_vector_status = JSON.parse(this.content_vector_status);
      } catch {
        this.content_vector_status = {};
      }
    }
  }
}

export default Connection;
