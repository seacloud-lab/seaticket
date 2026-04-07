import { hasOwnProperty } from '@/utils/object-utils';

class Option {
  constructor(object, predefinedConfig = {}) {
    this._id = String(object.id) || '';
    this.name = object.name || '';
    this.origin_name = this.name;

    this.description = object.description;
    this.color = object.color || '';
    this.text_color = object.text_color || '';
    // Support both tickets_count (for tickets) and issues_count (for portal issues)
    this.tickets_count = object.tickets_count || object.issues_count || 0;
    this.parent_id = object.parent_id || '';

    const predefinedConfigInfo = predefinedConfig[this._id] || predefinedConfig[this.name];

    if (predefinedConfigInfo) {
      const { description, color, text_color, name } = predefinedConfigInfo;
      if (!hasOwnProperty(object, 'name')) {
        this.name = name;
      }

      if (!hasOwnProperty(object, 'description')) {
        this.description = description;
      }

      if (!hasOwnProperty(object, 'color')) {
        this.color = color;
      }

      if (!hasOwnProperty(object, 'text_color')) {
        this.text_color = text_color;
      }
    }
  }

  _update = (keyValue = {}) => {
    Object.entries(keyValue).forEach(item => {
      const [key, value] = item;
      this[key] = value;
    });
    return this;
  };
}

class OptionsData {
  constructor(object = {}) {
    this.columns = object?.columns || [];
    this.key_column_map = {};
    this.columns.forEach(column => {
      this.key_column_map[column.key] = column;
    });

    this.rows = object?.rows || [];
    this.id_row_map = {};
    this.row_ids = [];
    this.rows.forEach(row => {
      this.row_ids.push(row._id);
      this.id_row_map[row._id] = row;
    });

    this.hasMore = true;
  }
}

export default OptionsData;
export {
  Option,
};
