import deepcopy from 'deep-copy';
class Activity {

  constructor(obj) {
    this.op_type = obj.op_type;
    this.op_time = obj.op_time;
    this.op_app = obj.op_app;
    this.author_email = obj.author_email;
    this.author_name = obj.author_name;
    this.author_contact_email = obj.author_contact_email;
    this.avatar_url = obj.avatar_url;
    this.app_avatar_url = obj.app_avatar_url;
    this.dtable_uuid = obj.dtable_uuid;
    this.table_id = obj.table_id;
    this.table_name = obj.table_name;
    this.row_id = obj.row_id;
    this.row_name = obj.row_name;
    this.row_name_option = obj.row_name_option;
    this.row_count = obj.row_count;
    this.row_data = [];
    if (obj.row_data && obj.row_data.length > 0) {
      this.row_data = obj.row_data.map(row_data => {
        let value = (typeof row_data.value) === 'object' ? deepcopy(row_data.value) : row_data.value;
        let old_value = (typeof row_data.old_value) === 'object' ? deepcopy(row_data.old_value) : row_data.old_value;
        return {
          column_key: row_data.column_key,
          column_name: row_data.column_name,
          column_type: row_data.column_type,
          column_data: deepcopy(row_data.column_data),
          value: value,
          old_value: old_value
        };
      });
    }
  }
}

export default Activity;
