class Row {
  constructor(object) {
    this._id = String(object._pk) || '';
    Object.keys(object).forEach(key => {
      this[key] = object[key];
    });
  }
}

export default Row;
