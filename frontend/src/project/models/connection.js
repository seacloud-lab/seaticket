import dayjs from '../../utils/dayjs';

class ConnectionRecord {
  constructor(object) {
    this.id = object.id || '';
    this.name = object.name || '';
    this.type = object.type || '';
    this.config = JSON.parse(object.config || '{}') || {};
    this.modifier = object.modifier || '';
    this.ctime = object.created_at || '';
    this.updated_at = object.updated_at || '';
    this.index_time = object.index_time || '';
    this.project_id = object.project_id || '';
    this.status = object.status || '';

    // update
    if (this.ctime) {
      this.ctime = dayjs(this.ctime).format('YYYY-MM-DD HH:mm:ss');
    }

    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';
    this.index_time = this.index_time ? dayjs(this.index_time).format('YYYY-MM-DD HH:mm:ss') : '--';

  }
}

export default ConnectionRecord;
