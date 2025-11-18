import dayjs from '@/utils/dayjs';

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

    // update
    if (this.ctime) {
      this.ctime = dayjs(this.ctime).format('YYYY-MM-DD HH:mm:ss');
    }
    this.indexed_at = this.indexed_at ? dayjs(this.indexed_at).format('YYYY-MM-DD HH:mm:ss') : '--';
    this.last_sync_time = this.last_sync_time ? dayjs(this.last_sync_time).format('YYYY-MM-DD HH:mm:ss') : '--';
    this.last_ai_processing_time = this.last_ai_processing_time ? dayjs(this.last_ai_processing_time).format('YYYY-MM-DD HH:mm:ss') : '--';

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
  }
}

export default Connection;
