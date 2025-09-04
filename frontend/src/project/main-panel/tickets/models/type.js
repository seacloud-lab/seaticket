class Type {
  constructor(object) {
    this._id = String(object.id) || '';
    this.id = String(object.id) || '';
    this.name = object.name || '';
    this.color = object.color || '';
    this.text_color = object.text_color || '';
    this.textColor = object.text_color || '';
    this.tickets_count = object.tickets_count || 0;
  }

  _update = (keyValue = {}) => {
    Object.entries(keyValue).forEach(item => {
      const [key, value] = item;
      this[key] = value;
    });
    return this;
  };
}

export default Type;
