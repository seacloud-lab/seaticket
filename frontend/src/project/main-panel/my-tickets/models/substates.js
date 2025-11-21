class SubstatesData {
  constructor(object) {
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

export default SubstatesData;
