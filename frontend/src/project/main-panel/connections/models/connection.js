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
    this.status = object.status || {};
    this.is_active = object.is_active || '';

    // update
    if (this.ctime) {
      this.ctime = dayjs(this.ctime).format('YYYY-MM-DD HH:mm:ss');
    }
    this.indexed_at = this.indexed_at ? dayjs(this.indexed_at).format('YYYY-MM-DD HH:mm:ss') : '--';
    this.last_sync_time = this.last_sync_time ? dayjs(this.last_sync_time).format('YYYY-MM-DD HH:mm:ss') : '--';
  }
}

export default Connection;
