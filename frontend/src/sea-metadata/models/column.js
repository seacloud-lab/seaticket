class Column {
  constructor(object) {
    this.key = object.key || '';
    this.origin_key = object.origin_key || '';
    this.name = object.name || '';
    this.type = object.type || '';
    this.data = object.data || null;
    this.width = object.width || 200;
    this.data = object.data || {};

    this.is_required = object.is_required || false;
    this.is_predefined = object.is_predefined || true;
    this.editable = object.editable || false;
    this.frozen = object.frozen || false;
    this.rename_able = object.rename_able || false;
    this.is_name_column = object.is_name_column || false;
    this.modify_data_able = object.modify_data_able || false;
    this.delete_able = object.delete_able || false;
    this.click = object.click || null;
  }

}

export default Column;
