import View from './view';
import Column from './column';

class Metadata {
  constructor(object) {
    const columns = object.columns || [];
    this.columns = columns.map(column => new Column(column));
    this.key_column_map = {};
    this.columns.forEach(column => {
      this.key_column_map[column.key] = column;
    });

    this.rows = object.rows || [];
    this.id_row_map = {};
    this.row_ids = [];
    this.rows.forEach(row => {
      this.row_ids.push(row._id);
      this.id_row_map[row._id] = row;
    });

    this.hasMore = true;
    this.rowsCount = this.row_ids.length;
    this.view = new View(object.view, this.columns);
  }

}

export default Metadata;
