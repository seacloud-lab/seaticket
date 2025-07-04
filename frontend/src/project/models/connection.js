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
    this.project_id = object.project_id || '';
    this.status = object.status || '';

    // update
    if (this.ctime) {
      this.ctime = dayjs(this.ctime).format('YYYY-MM-DD HH:mm:ss');
    }

    this.updated_at = this.updated_at ? dayjs(this.updated_at).fromNow() : '--';

  }
}

export default ConnectionRecord;
