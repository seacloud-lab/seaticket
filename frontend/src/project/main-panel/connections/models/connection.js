import { initConnectionStatus } from '../utils';

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
    this.is_active = object.is_active || '';
    this.last_ai_processing_time = object.last_ai_processing_time || '';
    this.ai_indexed_at = object.ai_indexed_at || '';
    this.content_vector_indexed_at = object.content_vector_indexed_at || '';

    this.status = initConnectionStatus(object.status || '{}');
    this.ai_status = initConnectionStatus(object.ai_status || '{}');
    this.content_vector_status = initConnectionStatus(object.content_vector_status || '{"last_content_vector_index_status": "pending","last_content_vector_indexed_count": 0}');
  }
}

export default Connection;
