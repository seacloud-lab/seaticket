import { PREDEFINED_TICKET_TAG_NAMES, PREDEFINED_TICKET_TAG } from '../constants';

class Tag {
  constructor(object) {
    this._id = String(object.id) || '';
    this.name = object.name || '';

    this.description = object.description;
    this.color = object.color || '';
    this.text_color = object.text_color || '';
    this.tickets_count = object.tickets_count || 0;

    if (PREDEFINED_TICKET_TAG_NAMES.includes(this.name)) {
      const { description, color, text_color, name } = PREDEFINED_TICKET_TAG[this.name];
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

export default Tag;
