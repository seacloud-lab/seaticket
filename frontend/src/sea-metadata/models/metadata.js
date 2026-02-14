import View from './view';
import Column from './column';
import Row from './row';

class Metadata {
  constructor(object) {
    this.error_msg = object.error_msg || '';
    const columns = object.columns || [];
    this.columns = columns.map(column => column instanceof Column ? column : new Column(column, object.columnWidthRules));
    this.linked_records = object.linked_records || {};
    this.key_column_map = {};
    this.columns.forEach(column => {
      this.key_column_map[column.key] = column;
    });

    this.rows = object.rows || [];
    this.rows = this.rows.map(r => new Row(r));
    this.id_row_map = {};
    this.row_ids = [];
    this.rows.forEach(row => {
      this.row_ids.push(row._id);
      this.id_row_map[row._id] = row;
    });

    this.hasMore = true;
    this.rowsCount = this.row_ids.length;
    this.view = new View(object.view, this.columns, object.notDisplayColumns);
  }

}

export default Metadata;
