
class SysAdminAdminUser {
  constructor(object) {
    this.email = object.email;
    this.name = object.name;
    this.contact_email = object.contact_email;
    this.login_id = object.login_id;
    this.last_login = object.last_login;
    this.create_time = object.create_time;
    this.is_active = object.is_active;
    this.is_staff = object.is_staff;
    this.admin_role = object.admin_role;
    this.isSelected = false;
    this.storage_usage = object.storage_usage;
    this.rows_count = object.rows_count || 0;
  }
}

export default SysAdminAdminUser;
