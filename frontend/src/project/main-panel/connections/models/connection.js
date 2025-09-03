import dayjs from '@/utils/dayjs';

class Connection {
  constructor(object) {
    this.id = object.id || '';
    this.name = object.name || '';
    this.type = object.type || '';
    this.config = object.config || {};
    this.modifier = object.modifier || '';
    this.ctime = object.created_at || '';
    this.updated_at = object.updated_at || '';
    this.indexed_at = object.indexed_at || '';
    this.synced_at = object.synced_at || '';
    this.project_id = object.project_id || '';
    this.status = object.status || {};
    this.is_active = object.is_active || '';

    // update
    if (this.ctime) {
      this.ctime = dayjs(this.ctime).format('YYYY-MM-DD HH:mm:ss');
    }
    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';
    this.indexed_at = this.indexed_at ? dayjs(this.indexed_at).format('YYYY-MM-DD HH:mm:ss') : '--';
    this.synced_at = this.synced_at ? dayjs(this.synced_at).format('YYYY-MM-DD HH:mm:ss') : '--';
  }
}

export default Connection;
