class SysAdminUser {
  constructor(object) {
    this.email = object.email;
    this.name = object.name;
    this.contact_email = object.contact_email;
    this.login_id = object.login_id;
    this.last_login = object.last_login;
    this.create_time = object.create_time;
    this.is_active = object.is_active;
    this.is_staff = object.is_staff;
    this.unit = object.unit;
    this.quota_total = object.quota_total;
    this.quota_usage = object.quota_usage;
    this.role = object.role;
    this.institution = object.institution;
    this.storage_usage = object.storage_usage;
    if (object.org_id) {
      this.org_id = object.org_id;
    }
    if (object.org_name) {
      this.org_name = object.org_name;
    }
    this.isSelected = false;
    this.rows_count = object.rows_count || 0;
    this.id_in_org = object.id_in_org || '--';
  }
}

export default SysAdminUser;
