import { getColumnByKey } from '../utils/column';
import { VIEW_TYPE_DEFAULT_SORTS, VIEW_DEFAULT_SETTINGS, VIEW_TYPE } from '../constants';

class View {

  constructor(object, columns) {
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

    // hidden columns
    this.hidden_columns = object.hidden_columns || [];

    // rows
    this.rows = object.rows || [];

    // columns
    // all columns
    this.available_columns = columns || [];

    // order display
    this.columns = this.available_columns;

    const display_available_columns = this.available_columns;

    // order
    let columnsKeys = object.columns_keys || [];
    if (columnsKeys.length === 0) {
      this.columns_keys = display_available_columns.map(c => c.key);
    } else {
      let columns = columnsKeys.map(key => getColumnByKey(display_available_columns, key)).filter(c => c);
      display_available_columns.forEach(column => {
        if (!getColumnByKey(columns, column.key)) {
          columns.push(column);
        }
      });
      this.columns_keys = columns.map(c => c.key);
      this.columns = columns;
    }

    // settings
    this.settings = object.settings || VIEW_DEFAULT_SETTINGS[this.type];
  }

}

export default View;
