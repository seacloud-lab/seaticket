import { getColumnByKey } from '../utils/column';
import { VIEW_TYPE_DEFAULT_SORTS, VIEW_DEFAULT_SETTINGS, VIEW_TYPE, ROW_HEIGHT_TYPE } from '../constants';

class View {

  constructor(object, columns, notDisplayColumns = []) {
    this._id = object._id || '';
    this.type = object.type || VIEW_TYPE.TABLE;

    this.name = object.name || '';

    // filter
    this.filters = object.filters || [];
    this.filter_conjunction = object.filter_conjunction || 'Or';

    this.basic_filters = object.basic_filters || [];

    // sort
    this.sorts = object.sorts && object.sorts.length > 0 ? object.sorts : VIEW_TYPE_DEFAULT_SORTS[this.type];

    // group
    this.groupbys = object.groupbys || [];
    this.groups = object.groups;

    // row height
    this.row_height = object.row_height || ROW_HEIGHT_TYPE.DEFAULT;

    // hidden columns
    this.hidden_columns = object.hidden_columns || [];

    // row color
    this.colorbys = object.colorbys || {};
    this.colors = object.colors || {};

    // rows
    this.rows = object.rows || [];

    // columns
    // all columns
    let available_columns = columns || [];
    available_columns = available_columns.filter(c => !(notDisplayColumns.includes(c.name) || notDisplayColumns.includes(c.key)));

    // order display
    this.columns = available_columns;

    // order
    let columnsKeys = object.columns_keys || [];
    if (columnsKeys.length === 0) {
      this.columns_keys = available_columns.map(c => c.key);
    } else {
      let _columns = columnsKeys.map(key => getColumnByKey(available_columns, key)).filter(c => c);
      available_columns.forEach(column => {
        if (!getColumnByKey(_columns, column.key)) {
          _columns.push(column);
        }
      });
      _columns = _columns.sort((a, b) => (b.frozen || 0) - (a.frozen || 0));
      this.columns_keys = _columns.map(c => c.key);
      this.columns = _columns;
    }

    // settings
    this.settings = object.settings || VIEW_DEFAULT_SETTINGS[this.type];
    this.is_locked = object.is_locked || false;
  }

}

export default View;
