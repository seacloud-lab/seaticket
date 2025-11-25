class Option {
  constructor(object, predefinedConfig = {}) {
    this._id = String(object.id) || '';
    this.name = object.name || '';

    this.description = object.description;
    this.color = object.color || '';
    this.text_color = object.text_color || '';
    this.tickets_count = object.tickets_count || 0;

    if (predefinedConfig[this.name]) {
      const { description, color, text_color, name } = predefinedConfig[this.name];
      this.name = name;
      this.description = description;
      this.color = color;
      this.text_color = text_color;
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
  constructor(object = {}, loadTime) {
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
    this.loadTime = loadTime || '';
    this.isLoading = false;
  }

  _updateLoading = (isLoading) => {
    this.isLoading = isLoading;
    return this;
  };
}

export default OptionsData;
export {
  Option,
};
