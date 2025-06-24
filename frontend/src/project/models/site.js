import dayjs from '../../utils/dayjs';

class Site {
  constructor(object) {
    this.id = object.id || '';
    this.name = object.name || '';
    this.url = object.url || '';
    this.sitemap_url = object.sitemap_url || '';
    this.modifier = object.modifier || '';
    this.ctime = object.created_at || '';
    this.last_crawled = object.last_crawled_at || '';
    this.project_id = object.project_id || '';
    this.status = object.status || '';

    // update
    if (this.ctime) {
      this.ctime = dayjs(this.ctime).format('YYYY-MM-DD HH:mm:ss');
    }

    this.last_crawled = this.last_crawled ? dayjs(this.last_crawled).fromNow() : '--';

  }
}

export default Site;
