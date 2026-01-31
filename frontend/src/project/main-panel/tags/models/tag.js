import { getColumnByName } from '@/sea-metadata/utils/column';

class Tag {
  constructor(columns = [], object) {
    this._id = String(object._pk) || '';
    const nameColumn = getColumnByName(columns, 'name');
    const colorColumn = getColumnByName(columns, 'color');
    const textColorColumn = getColumnByName(columns, 'text_color');
    const descriptionColumn = getColumnByName(columns, 'description');


    this.name = object.name || object[nameColumn?.key] || '';
    this.description = object.description || object[descriptionColumn?.key];
    this.color = object.color || object[colorColumn?.key] || '';
    this.text_color = object.text_color || object[textColorColumn?.key] || '';
  }

  _update = (keyValue = {}) => {
    Object.entries(keyValue).forEach(item => {
      const [key, value] = item;
      this[key] = value;
    });
    return this;
  };
}

export default Tag;
