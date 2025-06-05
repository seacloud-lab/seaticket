class UniversalApp {

  constructor(obj = {}) {

    /*
    * 'app_id': app.pk,
      'app_name': app.app_name,
      'app_uuid': app.app_uuid,
      'app_config': app.app_config,
      'role_name': role_name,
      'permission': role.role_permission,
      'link': app.link,
      'joined_at': datetime_to_isoformat_timestr(user.created_at)
    * */

    this.app_id = obj.app_id || '';
    this.app_name = obj.app_name || '';
    this.app_uuid = obj.app_uuid || '';
    this.app_config = obj.app_config || 0;
    this.link = obj.link || '';
    this.edit_link = obj.edit_link || '';
    this.joined_at = obj.joined_at || '';
    this.app_user_id = obj.app_user_id || '';

    // user_role
    this.role_name = obj.role_name || '';
    this.permission = obj.permission || '';

    // base related
    this.dtable_uuid = obj.dtable_uuid || '';
    this.dtable_name = obj.dtable_name || '';
    this.workspace_id = obj.workspace_id || '';
  }
}

export default UniversalApp;
