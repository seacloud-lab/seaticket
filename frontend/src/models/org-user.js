import { Utils } from '../utils/utils';
import dayjs from '../utils/dayjs';

class OrgUserInfo {
  constructor(object) {
    this.id = object.id;
    this.name = object.name;
    this.email = object.email;
    this.contact_email = object.owner_contact_email;
    this.is_active = object.is_active;
    this.quota = object.quota > 0 ? Utils.bytesToSize(object.quota) : '';
    this.self_usage = Utils.bytesToSize(object.self_usage);
    this.last_login = object.last_login ? dayjs(object.last_login).fromNow() : '--';
    this.ctime = dayjs(object.ctime).format('YYYY-MM-DD HH:mm:ss');
  }
}

export default OrgUserInfo;
